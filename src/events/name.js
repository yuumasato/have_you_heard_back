// Event: name
const Users = require('../server/users.service');
const Redis = require('../server/redis.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('name', async (name) => {
        let userID = `user_${socket.id}`
        console.log(`(${userID}) set name to ${name}`);

        await Redis.getIO(async (io) => {
            await Users.setName(io, `${userID}`, name, (user) => {
                console.log('Set user name callback');
                for (let r of socket.rooms) {
                    socket.to(r).emit('chat message', `User set name to ${user.name}`);
                }
            }).catch((msg) => {
                console.error(`Failed to set user ${userID} name to ` + name);
            });

            // Unlock Redis IO connection
            Redis.returnIO(io);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};


