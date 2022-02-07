// Event: vote persona
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');

const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('vote persona', async function vote_persona_handler(persona) {
        let userID = `user_${socket.id}`;
        let user = await Users.get(userID);

        // Check if the user exists
        if (!user) {
            console.error(`User ${userID} not found`);
            return;
        }

        // Check if the user is in a room
        if (!user.room) {
            console.error(`User ${userID} is not in a room`);
            return;
        }

        // Check if the game was already started
        if (!user.game) {
            console.error(`User is not in a game`);
            return;
        }

        let game = await Games.get(user.game);
        if (!game) {
            console.error(`Game ${user.game} not found`);
            return;
        }

        // Provide the callback to call when successful
        Games.votePersona(user, game, persona, (retGame) => {
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

                Games.nextRound(retGame, undefined, (startedGame) => {
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
    });
};

