// Event: answer
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');

const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('answer', async function answer_handler(answer) {
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
        Games.answer(user, game, answer, (retGame) => {
            console.log(`Received answer ${answer}`);

            let allAnswered = true;
            let answers = {};
            // Check if all the players answered
            for (let p of retGame.players) {
                if (p.answer) {
                    answers[p.id] = p.answer['answer'];
                } else {
                    allAnswered = false;
                    break;
                }
            }

            if (allAnswered) {
                console.log(`All answers gathered for game ${game.id}`);
                debug(`game:\n` + JSON.stringify(retGame, null, 2));
                let io = Server.getIO();
                io.to(user.room).emit('round answers', JSON.stringify(answers));
            } else {
                debug(`game:\n` + JSON.stringify(retGame, null, 2));
                console.log(`Game (${game.id}): Waiting for other players to answer`);
            }
        }, (err) => {
            console.error(`User ${userID} failed to answer: ` + err);
        });
    });
};

