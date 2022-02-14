// Rooms service

const redis = require('redis');
const User = require('./user.class');
const Room = require('./room.class');
const Redis = require('./redis.service');
const Server = require('./server.service');
const Users = require('./users.service');
const Games = require('./games.service');

const { runWithRetries } = require('./common');

// The class is given when something requires this module
module.exports = class Rooms {

    static instance = null;

    constructor() {
        this.toDestroy = {}
    }

    static init() {
        if (Rooms.instance == null) {
            Rooms.instance = new Rooms();
        }
    }

    static getInstance() {
        if (Rooms.instance == null) {
            Rooms.init();
        }
        return Rooms.instance;
    }

    static async get(redisIO, roomID) {
        try {
            let roomJSON = await redisIO.get(roomID);
            if (roomJSON) {
                return JSON.parse(roomJSON);
            }
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    /**
     * Remove user from a room and add to a new room.
     *
     * oldRoomID and newRoomID can be undefined, but not both at the same time:
     *   - oldRoomID undefined means adding the user to a room
     *   - newRoomID undefined means removing the user from a room
     */
    static swapRooms(redisIO, userID, oldRoomID, newRoomID, cb, errCB) {
        let toWatch = [userID];

        if (oldRoomID == newRoomID) {
            return 'ok';
        }

        if (oldRoomID) {
            toWatch.push(oldRoomID);
        }

        if (newRoomID) {
            toWatch.push(newRoomID);
        }

        // Use redis multi to create transaction:
        // - Remove from old room (if defined)
        // - Reassing old room owner if the user was the owner
        // - Delete old room if empty
        // - Add to new room
        // - Set user room as current room
        // - Store state

        async function op() {
            // Watch to prevent conflicts
            await redisIO.watch(toWatch);

            let userPromise = Users.get(redisIO, userID);
            let oldRoomPromise = undefined;
            let newRoomPromise = undefined;
            let oldRoom = undefined;
            let newRoom = undefined;

            if (oldRoomID) {
                oldRoomPromise = Rooms.get(redisIO, oldRoomID);
            }

            if (newRoomID) {
                newRoomPromise = Rooms.get(redisIO, newRoomID);
            }

            let user = await userPromise;
            if (!user) {
                throw new Error(`User ${userID} not found`);
            }

            // If oldRoomID is not defined but the user was in a room, make
            // the user leave the room they were
            if (!oldRoomID && user.room) {
                await redisIO.watch(user.room);
                oldRoomID = user.room;
                oldRoomPromise = Rooms.get(redisIO, oldRoomID);
            }

            // Remove the user from the old room
            if (oldRoomID) {
                oldRoom = await oldRoomPromise;
                if (!oldRoom) {
                    throw new Error(`Room ${oldRoomID} not found`);
                }

                // Remove the user from the old room
                oldRoom.users = oldRoom.users.filter((value, index, arr) => {
                    return value !== userID;
                });

                // If the user was the owner of the old room handover
                // ownership to the next. If the room is empty, it will be
                // destroyed.
                if (oldRoom.ownerID === userID) {
                    if (oldRoom.users.length > 0) {
                        oldRoom.ownerID = oldRoom.users[0];
                        console.log(`User ${oldRoom.owner} is now the owner`);
                    }
                }

                user.room = undefined;
            }

            // Find new room
            if (newRoomID) {
                newRoom = await newRoomPromise;
                if (!newRoom) {
                    throw new Error(`Room ${newRoomID} not found`);
                }

                // TODO: emit warning message
                if (newRoom.language !== user.language) {
                    console.warn(`User language ${user.language} does `+
                        `not match room language ${newRoom.language}`);
                }

                // Insert the user to the new room
                if (!newRoom.users.includes(userID)) {
                    newRoom.users.push(userID);
                    if (!newRoom.ownerID) {
                        newRoom.ownerID = userID;
                    }
                }

                user.room = newRoomID;
            }

            // Create transaction
            let multi = redisIO.multi();
            if (oldRoom) {
                multi.set(oldRoomID, JSON.stringify(oldRoom), redis.print);
                if (oldRoom.users.length <= 0) {
                    // If the room became empty, set expiration time
                    multi.expire(oldRoomID, 300, redis.print);
                    console.log(`Room ${oldRoomID} is empty and will be deleted`);
                }
            }

            if (newRoom) {
                multi.set(newRoomID, JSON.stringify(newRoom),
                           redis.print);
            }

            multi.set(userID, JSON.stringify(user), redis.print);

            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function(reply, index) {
                        console.log(`Swap transaction [${index}]: ${reply}`);
                    });

                    return {"user": user, "oldRoom": oldRoom, "newRoom": newRoom};
                } else {
                    throw 'Swap room transaction conflict';
                };
            });
        }

        return runWithRetries(op, cb, errCB);
    }

    /**
     * Create a new room and call the providede callback passing the created
     * room object.
     * */
    static create(redisIO, user, cb, errCB) {
        async function op() {
            // Generate 5 digit ID
            let roomID = 'room_' +
                     String(Math.floor(Math.random() * 100000)).padStart(5,'0');

            // Watch to prevent conflicts
            await redisIO.watch(roomID);

            let exist = await redisIO.exists(roomID);
            if (exist) {
                // Try again
                throw ('Generated room ID already exists');
            }

            // Create transaction
            let room = new Room(roomID, user.language);
            let multi = redisIO.multi();
            multi.set(roomID, JSON.stringify(room), redis.print);
            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function(reply, index) {
                        console.log(`Room create transaction [${index}]: ${reply}`);
                    });

                    return room;
                } else {
                    throw 'Create room transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }

    static async addUser(redisIO, userID, roomID, cb, errCB) {
        return Rooms.swapRooms(redisIO, userID, undefined, roomID, cb, errCB);
    }

    static async removeUser(redisIO, userID, roomID, cb, errCB) {
        return Rooms.swapRooms(redisIO, userID, roomID, undefined, cb, errCB);
    }

    static async destroy(redisIO, roomID, cb, errCB) {

        async function op () {
            // User transaction to avoid conflicts
            await redisIO.watch(roomID);

            let room = await Rooms.get(redisIO, roomID);
            if (!room) {
                throw new Error(`Room ${roomID} not found`);
            }

            // Empty rooms can be removed immediately
            if (room.users.length == 0 ) {
                return await redisIO.del(roomID);
            }

            await redisIO.watch(room.users);
            let multi = redisIO.multi();

            // Remove users from the room
            for (let userID of room.users) {
                let user = await Users.get(redisIO, userID);
                if (user) {
                    user.room = undefined;
                    multi.set(userID, JSON.stringify(user),
                              redis.print);
                }
            }

            multi.del(roomID, redis.print);
            multi.exec((err, replies) => {
                if (err) reject(err);

                if (replies) {
                    replies.forEach(function(reply, index) {
                        console.log(`Destroy room transaction [${index}]: ${reply}`);
                    });
                } else {
                    throw 'Destroy room transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }


    /**
     * Complete the room object, getting the user and game state
     * The user can provide callbacks for success and error cases
     * */
    static async complete(redisIO, room) {
        if (!room) {
            throw 'Invalid room object';
        }

        let allPromises = [];
        for (let user of room.users) {
            allPromises.push(Users.get(redisIO, user));
        }

        await Promise.all(allPromises).then((values) => {
            // Only add relevant information to the room
            let newUsers = []
            for (let v of values) {
                newUsers.push(
                    {
                        id: v.id,
                        name: v.name,
                    }
                )
            }

            room.users = newUsers;

        })

        return room;
    }
};
