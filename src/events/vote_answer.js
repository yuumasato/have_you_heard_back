// Event: vote answer
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Redis = require('../server/redis.service');

const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('vote answer', async (chosen) => {
        let userID = `user_${socket.id}`;
        await Redis.getIO(async (redisIO) => {
            let user = await Users.get(redisIO, userID);

            // Check if the user exists
            if (!user) {
                console.error(`User ${userID} not found`);
                Redis.returnIO(redisIO);
                return;
            }

            // Check if the user is in a room
            if (!user.room) {
                console.error(`User ${userID} is not in a room`);
                Redis.returnIO(redisIO);
                return;
            }

            // Check if the game was already started
            if (!user.game) {
                console.error(`User is not in a game`);
                Redis.returnIO(redisIO);
                return;
            }

            console.log(`Received vote for ${chosen} from ${user.name}`);
            // Provide the callback to call when successful
            await Games.voteAnswer(redisIO, user.id, user.game, chosen, async (retGame) => {
                console.log(`Registered vote for ${chosen} from ${user.name}`);

                let sumVotes = {};
                let allVoted = true;
                // Check if all the players voted
                for (let p of retGame.players) {
                    if (p.answerVote) {
                        // Only count valid votes
                        if (p.answerVote == "No voted answer") {
                            continue;
                        }
                        if (p.answerVote in sumVotes) {
                            sumVotes[p.answerVote]++;
                        } else {
                            sumVotes[p.answerVote] = 1;
                        }
                    } else {
                        allVoted = false;
                        break;
                    }
                }

                if (allVoted) {
                    let winner = undefined;
                    let keys = Object.keys(sumVotes);

                    debug(`All voted, find winner`);
                    // Check winner answer
                    for (k of keys) {
                        if (!winner) {
                            winner = k;
                        } else {
                            if (sumVotes[k] > sumVotes[winner]) {
                                winner = k;
                            } else if (sumVotes[k] === sumVotes[winner]) {

                                let winner_time = undefined;
                                let player_time = undefined;
                                // Break the tie according to time
                                for (let p of retGame.players) {
                                    if (p.id == k) {
                                        player_time = p.answer['time'];
                                    }
                                    if (p.id == winner) {
                                        winner_time = p.answer['time'];
                                    }
                                }

                                if (winner_time == undefined ||
                                    player_time == undefined)
                                {
                                    console.log(`DEBUG THIS: Times not registered`);
                                }
                                else if (player_time < winner_time) {
                                    winner = k;
                                }
                            }
                        }
                    }
                    // No one voted, so there is no obvious winner
                    // Let's find out who provided the fastest answer
                    if (winner == undefined) {
                        let fastest_player = undefined;
                        for (let p of retGame.players) {
                            if (fastest_player == undefined) {
                                fastest_player = p;
                            }
                            if (p.answer['time'] < fastest_player.answer['time']) {
                                fastest_player = p;
                            }
                        }
                        winner = fastest_player.id
                    }

                    console.log(`Round winner for game ${retGame.id}: ${winner}`);
                    debug(`Round ${retGame.round} of ${retGame.numRounds}`);
                    let io = Server.getIO();
                    io.to(user.room).emit('round winner', winner);

                    await Games.nextRound(redisIO, retGame.id, winner, async (startedGame) => {
                        if (startedGame.currentRound > startedGame.numRounds) {
                            // Finish game
                            if (!startedGame.match) {
                                throw new Error(`Game ${startedGame.id} ended without winner`);
                            }

                            io.to(user.room).emit('game winner', JSON.stringify(startedGame.match));

                            await Games.endGame(redisIO, startedGame.id, (endedGame) => {
                                console.log(`Game ${endedGame.id} ended`);
                            }, (err) => {
                                console.log(`Failed to end game ${startedGame.id}: ` + err);
                            });
                        } else {
                            debug(`Game round initialized for game ${startedGame.id}`);
                        }
                    }, (err) => {
                        console.error(`Failed to initialize new round for game ${retGame.id}: ` + err);
                    });
                } else {
                    console.log(`Game (${retGame.id}): Waiting for other players to vote`);
                }

                // Unlock Redis IO connection
                Redis.returnIO(redisIO);
            }, (err) => {
                console.error(`User ${userID} failed to vote for answer: ` + err);
            });
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};

