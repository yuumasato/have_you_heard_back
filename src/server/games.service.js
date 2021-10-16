// Games service

const redis = require('redis');
const User = require('./user.class');
const Game = require('./game.class');
const Redis = require('./redis.service');
const Server = require('./server.service');
const Users = require('./users.service');

// The class is given when something requires this module
module.exports = class Games {

    static instance = null;

    constructor() {
    }

    static init() {
        if (Games.instance == null) {
            Games.instance = new Games();
        }
    }

    static getInstance() {
        if (Games.instance == null) {
            Games.init();
        }
        return Games.instance;
    }

    static async get(gameID) {
        try {
            let gameJSON = await Redis.get(gameID);
            if (gameJSON) {
                return JSON.parse(gameJSON);
            }
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }


    /**
     * Get the headlines for the game
     */
    static async headlines(language) {

        //TODO get headlines from the database

        let headlines = [
            "Mock headline _____ round 1",
            "Mock headline _____ round 2",
            "Mock headline _____ round 3",
        ];

        return headlines;
    }

    /**
     * Create a new game and call the providede callback passing the created
     * game object.
     * */
    static async create(room, cb, errCB) {
        // Create new object
        let redisIO = Redis.getIO();

        if (!room || !room.ownerID || !room.users) {
            if (errCB) {
                errCB(new Error('Invalid room object'));
            }
            return undefined;
        }

        // Derive game ID from room ID
        let gameID = 'game_' + room.id.substring(5);
        let toWatch = room.users.concat(gameID, room.id);

        async function transaction(attempts) {
            // Watch to prevent conflicts
            redisIO.watch(toWatch, async (watchErr) => {
                try {
                    if (watchErr) throw (watchErr);

                    let exist = await Redis.exists(gameID);
                    if (exist) {
                        throw new Error(`Game ${gameID} already exists`);
                    }

                    let game = new Game(gameID);

                    // TODO: get headlines ramdomly
                    let allPromises = [];
                    for (let player of room.users) {
                        allPromises.push(Users.get(player));
                    }

                    //TODO provide language
                    let headlines = Games.headlines(undefined);

                    Promise.all(allPromises).then(async (values) => {

                        let users = values;

                        game.headlines = await headlines;
                        if (!game.headlines) {
                            throw new Error(`Could not get headlines`);
                        }

                        // Create transaction
                        let multi = redisIO.multi();

                        // Add only relevant information
                        for (let u of users) {
                            game.players.push(
                                {
                                    name: u.name,
                                    id: u.id,
                                }
                            );

                            // Add the game ID to each user in the game
                            u.game = gameID;
                            multi.set(u.id, JSON.stringify(u), redis.print);
                        }

                        // TODO decide if this is necessary
                        room.game = gameID;

                        multi.set(gameID, JSON.stringify(game), redis.print);
                        // TODO decide if this is necessary
                        multi.set(room.id, JSON.stringify(room), redis.print);
                        multi.exec((multiErr, replies) => {
                            if (multiErr) {
                                throw(multiErr);
                            }

                            if (replies) {
                                replies.forEach(function(reply, index) {
                                    console.log('Game create transaction: ' + reply.toString());
                                });

                                // In case of success, call the callback, if provided
                                if (cb) {
                                    cb(room, game);
                                }

                                return game;
                            } else {
                                if (attempts > 0) {
                                    console.log('Game create transaction conflict, retrying...');
                                    return transaction(--attempts);
                                } else {
                                    throw new Error('Maximum number of attempts tried for game create transaction');
                                }
                            }
                        });
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

    static async removePlayer(userID, gameID, cb, errCB) {
        // Create new object
        let redisIO = Redis.getIO();

        async function transaction(attempts) {
            // Watch to prevent conflicts
            redisIO.watch(userID, gameID, async (watchErr) => {
                try {
                    if (watchErr) throw (watchErr);

                    let game = await Games.get(gameID);
                    if (!game) {
                        throw new Error(`Game ${gameID} not found`);
                    }

                    let user = await Users.get(userID);
                    if (!user) {
                        throw new Error(`User ${userID} not found`);
                    }

                    if (!user.game) {
                        throw new Error(`User ${userID} was not in a game`);
                    }

                    if (user.game != gameID) {
                        throw new Error(`User ${userID} was not in game ${gameID}`);
                    }

                    let found = false;
                    // Remove the player from the game only if the player was in
                    // the game
                    game.players.find((p, i) => {
                        if (p.id === userID) {
                            found = true;
                        }
                    });

                    // Remove game info from user
                    delete(user.game);

                    // Create transaction
                    let multi = redisIO.multi();
                    multi.set(userID, JSON.stringify(user), redis.print);

                    // If the player was in the game, remove
                    if (found) {
                        game.players = game.players.filter((p) => {
                            return p.id !== userID;
                        });
                        multi.set(gameID, JSON.stringify(game), redis.print);
                    } else {
                        // User was not in the game anymore, set as undefined
                        // for the callback call
                        game = undefined;
                    }

                    multi.exec((multiErr, replies) => {
                        if (multiErr) {
                            throw(multiErr);
                        }

                        if (replies) {
                            replies.forEach(function(reply, index) {
                                console.log('Game remove player transaction: ' +
                                            reply.toString());
                            });

                            // In case of success, call the callback, if provided
                            if (cb) {
                                cb(user, game);
                            }

                            return game;
                        } else {
                            if (attempts > 0) {
                                console.log('Game create transaction conflict, retrying...');
                                return transaction(--attempts);
                            } else {
                                throw new Error('Maximum number of attempts tried for game create transaction');
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
}
