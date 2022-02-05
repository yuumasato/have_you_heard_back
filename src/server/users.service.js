// Users service

const redis = require('redis');
const User = require('./user.class');
const Room = require('./room.class');
const Redis = require('./redis.service');

const consts = require('./consts');

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
    static async create(userID, cb, errCB) {
        // Create new object
        let user = new User(userID);
        let redisIO = Redis.getIO();

        async function transaction(attempts) {
            // Watch to prevent conflicts
            redisIO.watch(userID, async (watchErr) => {
                try {
                    if (watchErr) {
                        throw(watchErr);
                    }

                    let exist = await Redis.exists(userID);

                    if (exist) {
                        throw new Error(`User ${userID} already exists`);
                    }

                    // Create transaction
                    let multi = redisIO.multi();
                    multi.set(userID, JSON.stringify(user), redis.print);
                    multi.exec((multiErr, replies) => {
                        if (multiErr) {
                            throw(multiErr);
                        }

                        if (replies) {
                            replies.forEach(function(reply, index) {
                                console.log('User create transaction: ' + reply.toString());
                            });

                            // In case of success, call the callback, if provided
                            if (cb) {
                                cb(user);
                            }

                            return user;
                        } else {
                            if (attempts > 0) {
                                console.log('User create transaction conflict, retrying...');
                                return transaction(--attempts);
                            } else {
                                return undefined;
                            }
                        }
                    });
                } catch (err) {
                    if (errCB) {
                        errCB(err);
                    } else {
                        console.error(err);
                    }
                }
            });
        }

        // Retry up to 5 times
        let resultPromise = new Promise((resolve, reject) => {
            try {
                transaction(5);
                resolve('ok');
            } catch(err) {
                reject(err);
            }
        });

        return resultPromise;
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

    /**
     * Set the user name. If a callback is provided, call it passing the
     * modified user object, if the transaction was successful
     * */
    static async setName(userID, name, cb, errCB) {
        // Create new object
        let redisIO = Redis.getIO();

        async function transaction(attempts) {
            // Watch to prevent conflicts
            redisIO.watch(userID, async (watchErr) => {
                try {
                    if (watchErr) {
                        throw(watchErr);
                    }

                    let user = await Users.get(userID);
                    if (!user) {
                        throw new Error(`User ${userID} not found`);
                    }

                    // Set user name
                    user.name = name;

                    // Create transaction
                    let multi = redisIO.multi();
                    multi.set(userID, JSON.stringify(user), redis.print);
                    multi.exec((multiErr, replies) => {
                        if (multiErr) {
                            throw(multiErr);
                        }

                        if (replies) {
                            replies.forEach(function(reply, index) {
                                console.log('User set name transaction: ' + reply.toString());
                            });

                            // In case of success, call the callback, if provided
                            if (cb) {
                                cb(user);
                            }

                            return user;
                        } else {
                            if (attempts > 0) {
                                console.log('User set name transaction conflict, retrying...');
                                return transaction(--attempts);
                            } else {
                                return undefined;
                            }
                        }
                    });
                } catch(err) {
                    if (errCB) {
                        errCB(err);
                    } else {
                        console.error(err);
                    }
                }
            });
        }

        // Retry up to 5 times
        let resultPromise = new Promise((resolve, reject) => {
            try {
                transaction(5);
                resolve('ok');
            } catch(err) {
                reject(err);
            }
        });

        return resultPromise;
    }

    /**
     * Set the user language. If a callback is provided, call it passing the
     * modified user object, if the transaction was successful
     * */
    static async setLanguage(userID, language, cb, errCB) {
        // Create new object
        let redisIO = Redis.getIO();

        async function transaction(attempts) {
            // Watch to prevent conflicts
            redisIO.watch(userID, async (watchErr) => {
                try {
                    if (watchErr) {
                        throw(watchErr);
                    }

                    if (!consts.SUPPORTED_LANGUAGES.includes(language)) {
                        throw new Error(`Language ${language} not supported`);
                    }

                    let user = await Users.get(userID);
                    if (!user) {
                        throw new Error(`User ${userID} not found`);
                    }

                    // Set user language
                    user.language = language;

                    // Create transaction
                    let multi = redisIO.multi();
                    multi.set(userID, JSON.stringify(user), redis.print);
                    multi.exec((multiErr, replies) => {
                        if (multiErr) {
                            throw(multiErr);
                        }

                        if (replies) {
                            replies.forEach(function(reply, index) {
                                console.log('User set language transaction: ' +
                                    reply.toString());
                            });

                            // In case of success, call the callback, if provided
                            if (cb) {
                                cb(user);
                            }

                            return user;
                        } else {
                            if (attempts > 0) {
                                console.log('User set name language conflict, retrying...');
                                return transaction(--attempts);
                            } else {
                                return undefined;
                            }
                        }
                    });
                } catch(err) {
                    if (errCB) {
                        errCB(err);
                    } else {
                        console.error(err);
                    }
                }
            });
        }

        // Retry up to 5 times
        let resultPromise = new Promise((resolve, reject) => {
            try {
                transaction(5);
                resolve('ok');
            } catch(err) {
                reject(err);
            }
        });

        return resultPromise;
    }

    static async destroy(userID) {
        try {
            return await Redis.del(userID);
        } catch (e) {
            console.error(e);
        }
    }

};
