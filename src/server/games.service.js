// Games service

const redis = require('redis');
const User = require('./user.class');
const Game = require('./game.class');
const Redis = require('./redis.service');
const Server = require('./server.service');
const Users = require('./users.service');

const { runWithRetries } = require('./common');
const debug = require('debug')('have_you_heard');

// The class is given when something requires this module
module.exports = class Games {

    static instance = null;

    constructor() {
        this.headlines_pool = [];
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

    static async get(redisIO, gameID) {
        try {
            let gameJSON = await redisIO.get(gameID);
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
        let server = Server.getInstance();
        let headlines = await server.nextHeadlines(language);
        return headlines;
    }

    /**
     * Create a new game and call the provided callback passing the created
     * game object.
     * */
    static async create(redisIO, room, cb, errCB) {

        if (!room || !room.ownerID || !room.users) {
            if (errCB) {
                errCB(new Error('Invalid room object'));
            }
            return undefined;
        }

        async function op() {
            // Derive game ID from room ID
            let gameID = 'game_' + room.id.substring(5);
            let toWatch = room.users.concat(gameID, room.id);

            // Use transaction to avoid conflicts
            await redisIO.watch(toWatch);

            let exist = await redisIO.exists(gameID);
            if (exist) {
                throw new Error(`Game ${gameID} already exists`);
            }

            let game = new Game(gameID);

            // Set number of rounds and initial round
            game.numRounds = 3;
            game.currentRound = 0;

            let allPromises = [];
            for (let player of room.users) {
                allPromises.push(Users.get(redisIO, player));
            }

            let headlines = Games.headlines(room.language);

            let users = await Promise.all(allPromises);

            game.headlines = await headlines;
            if (!game.headlines) {
                throw new Error(`Could not get headlines`);
            }

            // Create transaction
            let multi = redisIO.multi();

            // Add only relevant information
            for (let u of users) {
                await redisIO.watch(u.id);
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

            multi.set(gameID, JSON.stringify(game), redis.print);
            return multi.exec()
                .then((replies) => {
                    if (replies) {
                        replies.forEach(function (reply, index) {
                            console.log(`Game create transaction [${index}]: ${reply}`);
                        });

                        return game;
                    } else {
                        throw 'Create game transaction conflict';
                    }
                });
        }

        return runWithRetries(op, cb, errCB);
    }

    static async removePlayer(redisIO, userID, gameID, cb, errCB) {

        let toWatch = [userID, gameID];
        async function op() {
            redisIO.watch(toWatch);

            let game = await Games.get(redisIO, gameID);
            if (!game) {
                throw new Error(`Game ${gameID} not found`);
            }

            let user = await Users.get(redisIO, userID);
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
            delete (user.game);

            // Create transaction
            let multi = redisIO.multi();
            multi.set(userID, JSON.stringify(user), redis.print);

            // If the player was in the game, remove from the game
            if (found) {
                game.players = game.players.filter((p) => {
                    return p.id !== userID;
                });

                multi.set(gameID, JSON.stringify(game), redis.print);

                // If the list of players become empty, set expiration
                // time
                if (game.players.length <= 0) {
                    multi.expire(gameID, 300, redis.print);
                    console.log(`Game ${gameID} is empty and will be deleted`);
                }
            } else {
                // User was not in the game anymore, set as undefined
                // for the callback call
                game = undefined;
            }

            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function (reply, index) {
                        console.log('Game remove player transaction: ' +
                            reply.toString());
                    });

                    return game;
                } else {
                    throw 'Remove player transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }

    /**
     * Register the vote for a persona
     * */
    static async votePersona(redisIO, user, game, persona, cb, errCB) {
        // Create new object
        let toWatch = [user.id, game.id];

        async function op() {
            // Watch to prevent conflicts
            redisIO.watch(toWatch);
            let updated = false;
            game.players.find((p) => {
                if (p.id == user.id) {

                    if (p.personaVote) {
                        throw new Error(`User ${user.id} already voted for persona`);
                    }

                    p.personaVote = persona;
                    updated = true;
                }
            });

            if (updated) {
                // Create transaction
                let multi = redisIO.multi();
                multi.set(game.id, JSON.stringify(game), redis.print);
                return multi.exec()
                .then((replies) => {
                    if (replies) {
                        replies.forEach(function (reply, index) {
                            console.log(`Vote persona transaction [${index}]: ${reply}`);
                        });

                        return game;
                    } else {
                        throw 'Vote persona transaction conflict';
                    }
                });
            }
        }
        return runWithRetries(op, cb, errCB);
    }

    /**
     * Decide the game winner based on rounds won and time to answer
     * */
    static decideWinner(game) {
        let match = undefined;
        let roundsWon = {};

        for (let w of game.roundWinners) {
            if (w.id in roundsWon) {
                roundsWon[w.id]['rounds']++;
                roundsWon[w.id]['time'] += w.time;
            } else {
                roundsWon[w.id] = {};
                roundsWon[w.id]['id'] = w.id;
                roundsWon[w.id]['rounds'] = 1;
                roundsWon[w.id]['time'] = w.time;
            }
        }

        let sortableWinners = [];
        for (let k in roundsWon) {
            sortableWinners.push(roundsWon[k]);
        }

        // Sort in reverse order: more rounds/less time first
        sortableWinners.sort((a, b) => {
            if (a['rounds'] === b['rounds']) {
                // This is reversed because less time is better
                return a['time'] - b['time'];
            } else {
                return b['rounds'] - a['rounds'];
            }
        });

        debug(`sortableWinners = ` + JSON.stringify(sortableWinners, null, 2));
        let tie = false;
        if (sortableWinners.length > 1) {
            if (sortableWinners[0].rounds === sortableWinners[1].rounds) {
                tie = true;
            }
        }

        match = {};
        match.stats = {};
        for (let w of sortableWinners) {
            match.stats[w.id] = w.rounds;
        }
        match.winner = sortableWinners[0].id;
        match.tie = tie;

        debug(`match = ` + JSON.stringify(match, null, 2));

        return match;
    }

    /**
     * Prepare new round
     * */
    static async nextRound(redisIO, game, roundWinner, cb, errCB) {
        async function op() {
            redisIO.watch(game.id);

            if (roundWinner) {
                if (!game.roundWinners) {
                    game.roundWinners = [];
                }

                game.players.find((p) => {
                    if (p.id == roundWinner) {
                        game.roundWinners.push(
                            {
                                id: roundWinner,
                                time: p.answer.time
                            }
                        );
                    }
                });

                if (game.roundWinners.length >= game.numRounds) {
                    game.match = Games.decideWinner(game);
                    console.log(`The game (${game.id}) winner was ${game.match.winner}`);
                }
            }

            game.currentRound++;
            game.roundStart = Date.now();

            // Remove answers from previous round
            for (let p of game.players) {
                p.answer = undefined;
                p.answerVote = undefined;
            }

            let multi = redisIO.multi();
            multi.set(game.id, JSON.stringify(game), redis.print);
            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function (reply, index) {
                        console.log(`New round transaction [${index}]: ${reply}`);
                    });

                    return game;
                } else {
                    throw 'Next round transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }

    /**
     * Register the vote for an answer
     * */
    static async answer(redisIO, user, game, answer, cb, errCB) {
        let toWatch = [user.id, game.id];

        async function op() {
            // Watch to prevent conflicts
            redisIO.watch(toWatch)

            let updated = false;
            game.players.find((p) => {
                if (p.id == user.id) {
                    if (p.answer) {
                        throw new Error(`User ${user.id} already answered`);
                    }

                    let now = Date.now();
                    p.answer = {
                        time: now - game.roundStart,
                        answer: answer
                    }
                    updated = true;
                }
            });

            if (updated) {
                // Create transaction
                let multi = redisIO.multi();
                multi.set(game.id, JSON.stringify(game), redis.print);
                return multi.exec()
                .then((replies) => {
                    if (replies) {
                        replies.forEach(function (reply, index) {
                            console.log(`Answer transaction [${index}]: ${reply}`);
                        });

                        return game;
                    } else {
                        throw 'Answer transaction conflict';
                    }
                });
            } else {
                throw new Error(`User ${user.id} not in game ${game.id}`);
            }
        }

        return runWithRetries(op, cb, errCB);
    }

    /**
     * Register the vote for an answer
     * */
    static async voteAnswer(redisIO, user, game, chosen, cb, errCB) {
        let toWatch = [user.id, game.id];

        async function op() {
            // Watch to prevent conflicts
            redisIO.watch(toWatch)
            let updated = false;
            game.players.find((p) => {
                if (p.id == user.id) {
                    if (p.answerVote) {
                        throw `User ${user.id} already voted for answer`;
                    }

                    p.answerVote = chosen;
                    updated = true;
                }
            });

            if (updated) {
                // Create transaction
                let multi = redisIO.multi();
                multi.set(game.id, JSON.stringify(game), redis.print);
                return multi.exec()
                .then((replies) => {
                    if (replies) {
                        replies.forEach(function (reply, index) {
                            console.log(`Vote answer transaction [${index}]: ${reply}`);
                        });

                        return game;
                    } else {
                        throw 'Vote answer transaction conflict';
                    }
                });
            } else {
                throw new Error(`User ${user.id} not in game ${game.id}`);
            }
        }

        return runWithRetries(op, cb, errCB);
    }

    static async endGame(redisIO, game, cb, errCB) {
        let toWatch = [game.id];
        for (let p of game.players) {
            toWatch.push(p.id);
        }

        async function op() {
            // Watch to prevent conflicts
            redisIO.watch(toWatch)

            // Create transaction
            let multi = redisIO.multi();

            let allPromises = [];
            for (let player of game.players) {
                allPromises.push(Users.get(redisIO, player.id));
            }

            let values = await Promise.all(allPromises);
            for (let user of values) {
                delete (user.game);
                multi.set(user.id, JSON.stringify(user), redis.print);
            }

            multi.del(game.id, redis.print);
            return multi.exec()
            .then((replies) => {
                if (replies) {
                    replies.forEach(function (reply, index) {
                        console.log(`End game transaction [${index}]: ${reply}`);
                    });

                    return game;
                } else {
                    throw 'End game transaction conflict';
                }
            });
        }

        return runWithRetries(op, cb, errCB);
    }
}
