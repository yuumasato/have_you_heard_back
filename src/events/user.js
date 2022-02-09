// Event: user

const Users = require('../server/users.service');
const Redis = require('../server/redis.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('user', async (id) => {
        //TODO for now, we ignore the provided ID and always create a new user
        console.log(`received user ID from ${socket.id}: ` + id);

        await Redis.getIO(async (redisIO) => {
            // Create user
            await Users.create(redisIO, `user_${socket.id}`, async (user) => {
                if (user) {
                    socket.emit('user id', `${user.id}`);

                    // Listen to these events
                    require('./message')(socket);
                    require('./join')(socket);
                    require('./leave')(socket);
                    require('./new_room')(socket);
                    require('./name')(socket);
                    require('./language')(socket);
                    require('./start')(socket);
                    require('./vote_persona')(socket);
                    require('./answer')(socket);
                    require('./vote_answer')(socket);
                    require('./rematch')(socket);
                } else {
                    console.error('Could not create user');
                }
            }, (err) => {
                console.error('Could not create user: ' + err);
            });

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};
