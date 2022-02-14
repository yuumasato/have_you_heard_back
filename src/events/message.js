// Event: 
const Server = require('../server/server.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Redis = require('../server/redis.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('chat message', async(msg) => {
        await Redis.getIO(async (redisIO) => {
            let userID = `user_${socket.id}`
            let user = await Users.get(redisIO, userID);
            if (user) {
                console.log(`${user.name}(${user.id}) message: ` + msg);
                io.to(user.room).emit('chat message', `${user.name}: ${msg}`);
            }

            // Unlock Redis IO connection
            Redis.returnIO(io);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};
