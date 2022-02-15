// Event: start
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Redis = require('../server/redis.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('start', async function start_handler() {
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

            let room = await Rooms.get(redisIO, user.room);
            if (!room) {
                // User should be in a room but the room is no more
                // This should never happen
                //TODO try to fix the state
                console.error(`Room ${user.room} not found`);
                Redis.returnIO(redisIO);
                return;
            }

            // Only allow the owner to start games
            if (room.ownerID !== userID) {
                console.error(`User ${userID} is not the owner of the room`);
                Redis.returnIO(redisIO);
                return;
            }

            // Require a minimum of 3 players
            if (room.users.length < 3) {
                console.error(`The room needs at least 3 players to start a game`);
                Redis.returnIO(redisIO);
                return;
            }

            // Provide the callback to call when successful
            await Games.create(redisIO, room, async (game) => {
                let io = Server.getIO();

                io.to(room.id).emit('game', JSON.stringify(game));
                console.log(`user ${user.id} started game on room ${room.id}`);

                console.log(`game:\n` + JSON.stringify(game, null, 2));
            }, (err) => {
                // Rollback
                console.error(`User ${userID} failed to start the game on room ${room.id}: ` + err);
            });

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};

