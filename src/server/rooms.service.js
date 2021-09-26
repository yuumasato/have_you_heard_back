// Rooms service

const redis = require('redis');
const User = require('./user.class');
const Room = require('./room.class');
const Redis = require('./redis.service');
const Server = require('./server.service');
const Users = require('./users.service');

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

    static async get(roomID) {
        try {
            let roomJSON = await Redis.get(roomID);
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
    static async swapRooms(userID, oldRoomID, newRoomID) {
        let io = Server.getIO();
        let redisIO = Redis.getIO();
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

        let resultPromise = new Promise(async (resolve, reject) => {
            try {
                // Watch to prevent conflicts
                redisIO.watch(toWatch, async (err) => {
                    if (err) reject(err);

                    let userPromise = Users.get(userID);
                    let oldRoomPromise = undefined;
                    let newRoomPromise = undefined;
                    let oldRoom = undefined;
                    let newRoom = undefined;

                    if (oldRoomID) {
                        oldRoomPromise = Rooms.get(oldRoomID);
                    }

                    if (newRoomID) {
                        newRoomPromise = Rooms.get(newRoomID);
                    }

                    let user = await userPromise;
                    if (!user) {
                        reject(`User ${userID} not found`);
                    }

                    console.log('user found');

                    // If oldRoomID is not defined but the user was in a room, make
                    // the user leave the room they were
                    if (!oldRoomID && user.room) {
                        oldRoomID = user.room;
                        oldRoomPromise = Rooms.get(oldRoomID);
                    }

                    // Remove the user from the old room
                    if (oldRoomID) {
                        oldRoom = await oldRoomPromise;
                        if (!oldRoom) {
                            reject(`Room ${oldRoomID} not found`);
                        }
                        // Remove the user from the old room
                        oldRoom.users = oldRoom.users.filter((value, index, arr) => {
                            return value !== userID;
                        });

                        // If the user was the owner of the old room handover
                        // ownership to the next. If the room is empty, it will be
                        // destroyed.
                        if (oldRoom.ownerID === userID) {
                            console.log('User was the owner');
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
                            reject(`Room ${newRoomID} not found`);
                        }

                        console.log('new room found');
                        // Insert the user to the new room
                        if (!newRoom.users.includes(userID)) {
                            newRoom.users.push(userID);
                            if (!newRoom.ownerID) {
                                newRoom.ownerID = userID;
                            }
                        }

                        user.room = newRoomID;
                    }

                    console.log("create transaction");
                    // Create transaction
                    let multi = redisIO.multi();
                    if (oldRoom) {
                        if (oldRoom.users.length <= 0) {
                            // TODO use autodestroy instead of imediately destroying
                            multi.del(oldRoomID, redis.print);
                            console.log(`Room ${oldRoomID} is empty and will be deleted`);
                        } else {
                            multi.set(oldRoomID, JSON.stringify(oldRoom),
                                      redis.print);
                        }
                    }

                    if (newRoom) {
                        multi.set(newRoomID, JSON.stringify(newRoom),
                                   redis.print);
                    }

                    multi.set(userID, JSON.stringify(user), redis.print);

                    multi.exec((err, replies) => {
                        if (err) reject(err);

                        console.log('DEBUG did not throw');

                        if (replies) {
                            replies.forEach(function(reply, index) {
                                console.log("SWAP @ index " + index + ": " +
                                            reply.toString());
                            });

                            // Update user in socket.io if the transaction was successful
                            if (oldRoom && oldRoom.users.length > 0) {
                                io.to(oldRoomID).emit('room', JSON.stringify(oldRoom));
                            }

                            if (newRoom) {
                                io.to(newRoomID).emit('room', JSON.stringify(newRoom));
                            }
                            resolve('ok');
                        } else {
                            console.log('replies null');
                            console.error('Transaction conflict');
                        }
                    });
                });
            } catch (e) {
                console.error(e);
            }
        }).catch((e) => console.log(e));
        return resultPromise;
    }

    /**
     * Create a new empty room.
     */
    static async create() {
        let redisIO = Redis.getIO();
        let roomID = undefined;
        let tries = 0;

        // Generate 5 digit ID
        roomID = 'room_' +
                 String(Math.floor(Math.random() * 100000)).padStart(5,'0');

        try {
            if (await Redis.exists(roomID)) {
                reject(`Aborted creation, Room ${roomID} exists`);
            }

            let room = new Room(roomID);
            let res = await Redis.set(roomID, JSON.stringify(room));

            if (res) {
                return room;
            }
            return res;
        } catch (e) {
            console.error(e);
        }
    }

    static async addUser(userID, roomID) {
        return Rooms.swapRooms(userID, undefined, roomID);
    }

    static async removeUser(userID, roomID) {
        return Rooms.swapRooms(userID, roomID, undefined);
    }

    static async destroy(roomID) {
        let io = Server.getIO();
        let room = await Rooms.get(roomID);
        let toWatch = [roomID];

        if (!room) {
            throw new Error(`Room ${roomID} not found`);
        }

        // Empty rooms can be removed immediately
        if (room.users.length == 0 ) {
            return await Redis.del(roomID);
        }

        toWatch = toWatch.concat(room.users);
        let redisIO = Redis.getIO();
        try {
            // User transaction to avoid conflicts
            redisIO.watch(toWatch, async (err, result) => {
                if (err) reject(err);
                let multi = redisIO.multi();

                for (let userID of room.users) {
                    let user = await Users.get(userID);
                    if (user) {
                        user.room = undefined;
                        multi.set(userID, JSON.stringify(user),
                                  redis.print);
                    }
                }

                multi.del(roomID, redis.print);

                multi.exec((err, replies) => {
                    if (err) reject(err);
                    replies.forEach(function(reply, index) {
                        console.log("DESTROY @ index " + index + ": " +
                                    reply.toString());
                    });

                    io.socketsLeave(roomID);
                    resolve('ok');
                });
            });
        } catch (e) {
            console.error(e);
            reject(e);
        }
        return await result;
    }
};
