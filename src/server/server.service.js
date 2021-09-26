//class Server

const User = require('./user.class');
const Room = require('./room.class');

module.exports = class Server {

    static instance = null;

    constructor(ex, io) {
        // express instance
        this.ex = ex;
        // socket.io instance
        this.io = io;

        this.rooms = {};
        this.users = {};
    }

    static init(ex, io) {
        if (Server.instance == null) {
            Server.instance = new Server(ex, io);
        }
    }

    static getInstance() {
        return Server.instance;
    }

    static getIO() {
        return Server.instance.io;
    }

    static getExpress() {
        return Server.intance.ex;
    }

    // When the last user leaves the room, autodestruction is scheduled
    destroyRoom(roomID) {
        r = this.rooms[roomID];
        r.destroy();
        this.rooms.delete(roomID);
        console.log(`Room ${roomID} destroyed`);
    }

    roomAutodestroy(room) {
        // Set the timeout to destroy the room in 5 minutes (300000 ms)
        room.timeout = setTimeout(this.destroyRoom(room.id), 300000);
        console.log(`Autodestruct room ${room.id} in 5 minutes`);
    }

    // Create new user or recover user before autodestruction
    createUser(socket, userID) {
        let user = undefined;

        // Search for existing user with the given ID
        if (userID) {
            console.log(`User: ${userID} reconnected`);

            // TODO Search for user
            user = this.users[userID];

            if (user) {
                // Cancel autodestruction
                if (user.timeout) {
                    console.log(`Cancel autodestruction of user ${user.id}`);
                    clearTimeout(user.timeout);
                }

                // Remove user from previous room
                if (user.room) {
                    user.room.removeUser(userID);
                    // If it was the last user, set autodestruct
                    if (user.room.users.size <= 0) {
                        this.roomAutodestroy(user.room);
                    }
                }
            } else {
                // User existed, but was already destroyed
                user = new User(socket);
                user.id = socket.id;

                // Add the new user to the map
                this.users[user.id] = user;
            }
        } else {
            // New user
            console.log(`New user ${socket.id} connected`);
            user = new User(socket);
            user.id = socket.id;

            // Add the new user to the map
            this.users[user.id] = user;
        }

        return user;
    }

    getUser(userID) {
        return this.users[userID];
    }

    userAutodestruct(user) {
        // Set the timeout to destroy the user in 5 minutes (300000 ms)
        user.timeout = setTimeout(this.destroyUser(user.id), 300000);
        console.log(`Autodestruct user ${user.id} in 5 minutes`);
    }

    // When the user disconnects, autodestruction is scheduled
    destroyUser(userID) {
        // Remove the user from the room
        user = this.users[userID];

        if (user) {
            if (user.room) {
                user.room.removeUser(userID);
                // If it was the last user, set autodestruct
                if (user.room.users.size <= 0) {
                    this.roomAutodestroy(user.room);
                }
            }
        }

        this.users.delete(userID);
        console.log(`User ${userID} destroyed`);
    }
};
