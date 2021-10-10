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

                        // Add only relevant information
                        for (let v of values) {
                            game.players.push(
                                {
                                    name: v.name,
                                    id: v.id,
                                }
                            );
                        }

                        game.headlines = await headlines;

                        // TODO decide if this is necessary
                        room.game = gameID;

                        // Create transaction
                        let multi = redisIO.multi();
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
}
