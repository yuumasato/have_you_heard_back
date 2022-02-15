// Event: vote persona
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Redis = require('../server/redis.service');

const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('vote persona', async function vote_persona_handler(persona) {
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

            let game = await Games.get(redisIO, user.game);
            if (!game) {
                console.error(`Game ${user.game} not found`);
                Redis.returnIO(redisIO);
                return;
            }

            // Provide the callback to call when successful
            await Games.votePersona(redisIO, user, game, persona, async (retGame) => {
                console.log(`Received vote for ${persona}`);

                let histogram = {};
                let allVoted = true;
                // Check if all the players voted
                for (let p of retGame.players) {
                    if (p.personaVote) {
                        if (p.personaVote in histogram) {
                            histogram[p.personaVote]++;
                        } else {
                            histogram[p.personaVote] = 1;
                        }
                    } else {
                        allVoted = false;
                        break;
                    }
                }

                if (allVoted) {
                    let winner = undefined;
                    let keys = Object.keys(histogram);
                    // Check winner persona
                    for (k of keys) {
                        if (!winner) {
                            winner = k;
                        } else {
                            if (histogram[k] > histogram[winner]) {
                                winner = k;
                            }
                        }
                    }

                    console.log(`Persona defined for game ${game.id}: ${winner}`);
                    debug(`game:\n` + JSON.stringify(retGame, null, 2));
                    let io = Server.getIO();
                    io.to(user.room).emit('persona', winner);

                    await Games.nextRound(redisIO, retGame, undefined, (startedGame) => {
                        debug(`Game round initialized for game ${startedGame.id}`);
                        debug(`game:\n` + JSON.stringify(startedGame, null, 2));
                    }, (err) => {
                        console.err(`Failed to initialize new round for game ${startedGame.id}: ` + err);
                    });
                } else {
                    debug(`game:\n` + JSON.stringify(retGame, null, 2));
                    console.log(`Game (${game.id}): Waiting for other players to vote`);
                }
            }, (err) => {
                console.error(`User ${userID} failed to vote for persona: ` + err);
            });

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO');
        });
    });
};

