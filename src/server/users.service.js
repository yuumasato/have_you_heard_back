// Users service

const User = require('./user.class');
const Room = require('./room.class');
const Redis = require('./redis.service');

// The class is given when something requires this module
module.exports = class Users {

    static instance = null;

    constructor() {
        this.toDestroy = {}
    }

    static init() {
        if (Users.instance == null) {
            Users.instance = new Users();
        }
    }

    static getInstance() {
        if (Users.instance == null) {
            Users.init();
        }
        return Users.instance;
    }

    static async create(userID) {
        // Create new object
        let user = new User(userID);
        try {
            await Redis.set(userID, JSON.stringify(user));
            return user;
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    static async get(userID) {
        try {
            let userJSON = await Redis.get(userID);
            if (userJSON) {
                let parsed = JSON.parse(userJSON);
                parsed.__proto__ = User.prototype;
                return parsed;
            }
        } catch (e) {
            console.error(e);
        }
        return undefined
    }

    static async setName(userID, name) {
        try {
            let user = await Users.get(userID);
            if (!user) {
                throw new Error(`User ${userID} not found`);
            }
            user.name = name;
            return await Redis.set(userID, JSON.stringify(user));
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    static async destroy(userID) {
        try {
            return await Redis.del(userID);
        } catch (e) {
            console.error(e);
        }
    }

};
