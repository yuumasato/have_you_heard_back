// Event: leave
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Redis = require('../server/redis.service');
const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('rematch', async () => {
        let userID = `user_${socket.id}`

        await Redis.getIO(async (redisIO) => {

            let user = await Users.get(redisIO, userID);

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

            // Check if the user is still in a game
            if (!user.game) {
                console.error(`User is not in a game`);
                return;
            }

            await Games.removePlayer(redisIO, userID, user.game, async (game) => {
                console.log(`User ${userID} wants a rematch`);
                console.log('Waiting for other players to decide');
            }, (err) => {
                console.error(`Could not process ${userID} rematch: ` + err);
            });

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        });
    });
};


