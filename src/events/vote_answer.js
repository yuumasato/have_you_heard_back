// Event: vote answer
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('vote answer', async function vote_answer_handler(chosen) {
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
        Games.voteAnswer(user, game, chosen, (retGame) => {
            console.log(`Received vote for ${chosen}`);

            let sumVotes = {};
            let allVoted = true;
            // Check if all the players voted
            for (let p of retGame.players) {
                if (p.answerVote) {
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
                // Check winner answer
                for (k of keys) {
                    if (!winner) {
                        winner = k;
                    } else {
                        if (sumVotes[k] > sumVotes[winner]) {
                            winner = k;
                        } else if (sumVotes[k] === sumVotes[winner]) {
                            if (retGame.players[k].answer['time'] <
                                retGame.players[winner].answer['time'])
                            {
                                winner = k;
                            }
                        }
                    }
                }

                console.log(`Round winner for game ${game.id}: ${winner}`);
                console.debug(`game:\n` + JSON.stringify(retGame, null, 2));
                let io = Server.getIO();
                io.to(user.room).emit('round winner', winner);

                Games.nextRound(retGame, winner, (startedGame) => {
                    if (startedGame.currentRound > startedGame.numRounds) {
                        // Finish game
                        if (!startedGame.match) {
                            throw new Error(`Game ${startedGame.id} ended without winner`);
                        }
                        io.to(user.room).emit('game winner', JSON.stringify(game.match));
                    }
                    console.debug(`Game round initialized for game ${startedGame.id}`);
                    console.debug(`game:\n` + JSON.stringify(startedGame, null, 2));
                }, (err) => {
                    console.error(`Failed to initialize new round for game ${retGame.id}: ` + err);
                });
            } else {
                console.debug(`game:\n` + JSON.stringify(retGame, null, 2));
                console.log(`Game (${game.id}): Waiting for other players to vote`);
            }
        }, (err) => {
            console.error(`User ${userID} failed to vote for answer: ` + err);
        });
    });
};

