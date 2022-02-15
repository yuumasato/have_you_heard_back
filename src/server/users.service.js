// Users service

const redis = require('redis');
const User = require('./user.class');
const Room = require('./room.class');
const Redis = require('./redis.service');
const { runWithRetries } = require('./common');

const consts = require('./consts');
const common = require('./common');

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

    /**
     * Create a new user and call the providede callback passing the created
     * user object.
     * */
    static create(redisIO, userID, cb, errCB) {
        // Create new object
        let user = new User(userID);

        async function op() {
            await redisIO.watch(userID);

            let exist = await redisIO.exists(userID);

            if (exist) {
                throw new Error(`User ${userID} already exists`);
            }

            // Create transaction
            let multi = redisIO.multi();
            await multi.set(userID, JSON.stringify(user), redis.print);

            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function (reply, index) {
                        console.log(`User create transaction [${index}]: ${reply}`);
                    });

                    return user;
                } else {
                    throw 'User create transaction conflict';
                }
            });
        }

        return common.runWithRetries(op, cb, errCB);
    }

    static async get(redisIO, userID) {
        try {
            let userJSON = await redisIO.get(userID);
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

    /**
     * Set the user name. If a callback is provided, call it passing the
     * modified user object, if the transaction was successful
     * */
    static setName(redisIO, userID, name, cb, errCB) {
        // Create new object

        async function op() {
            // Watch to prevent conflicts
            await redisIO.watch(userID);

            let user = await Users.get(redisIO, userID);
            if (!user) {
                throw new Error(`User ${userID} not found`);
            }

            // Set user name
            user.name = name;

            // Create transaction
            let multi = redisIO.multi();
            multi.set(userID, JSON.stringify(user), redis.print);

            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function(reply, index) {
                        console.log(`User set name transaction [${index}]: ${reply}`);
                    });

                    return user;
                } else {
                    throw 'User set name transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }

    /**
     * Set the user language. If a callback is provided, call it passing the
     * modified user object, if the transaction was successful
     * */
    static setLanguage(redisIO, userID, language, cb, errCB) {
        async function op() {
            // Watch to prevent conflicts
            await redisIO.watch(userID);

            if (!consts.SUPPORTED_LANGUAGES.includes(language)) {
                throw new Error(`Language ${language} not supported`);
            }

            let user = await Users.get(redisIO, userID);
            if (!user) {
                throw new Error(`User ${userID} not found`);
            }

            // Set user language
            user.language = language;

            // Create transaction
            let multi = redisIO.multi();
            multi.set(userID, JSON.stringify(user), redis.print);
            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function(reply, index) {
                        console.log(`User set language transaction [${index}]: ${reply}`);
                    });

                    return user;
                } else {
                    throw 'User set language transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }

    static async destroy(redisIO, userID) {
        try {
            return await redisIO.del(userID);
        } catch (e) {
            console.error(e);
        }
    }

};
