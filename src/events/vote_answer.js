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

                winner = Games.decideRoundWinner(retGame);

                if (winner) {
                    let io = Server.getIO();
                    io.to(user.room).emit('round winner', winner);

                    await Games.nextRound(redisIO, retGame.id, winner, async (startedGame) => {
                        if (startedGame.currentRound > startedGame.numRounds) {
                            // Finish game
                            if (!startedGame.match) {
                                throw new Error(`Game ${startedGame.id} ended without winner`);
                            }

                            io.to(user.room).emit('game winner', JSON.stringify(startedGame.match));
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

