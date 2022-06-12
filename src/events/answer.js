// Event: answer
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Redis = require('../server/redis.service');

const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('answer', async function answer_handler(answer) {

        // Generate the answer to be registered immediately
        let now = Date.now();

        let userID = `user_${socket.id}`;
        debug(`Player ${userID} answered: ${answer}`);
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

            // Calculate the time spent to answer
            let answer_time = {
                time: now - game.roundStart,
                answer: answer
            }

            // Provide the callback to call when successful
            await Games.answer(redisIO, userID, game.id, answer_time, (retGame) => {

                let decision = Games.decideAllAnswered(retGame);

                if (decision[0]) {
                    Games.announceAnswers(retGame, user.room, decision[1]);
                } else {
                    console.log(`Game (${game.id}): Waiting for other players to answer`);
                }
            }, (err) => {
                console.error(`User ${userID} failed to answer: ` + err);
            });

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};

