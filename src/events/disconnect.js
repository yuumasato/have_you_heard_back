// Event: disconnect
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('disconnect', async () => {
        console.log(`socket ID ${socket.id} disconnected`);
        let userID = `user_${socket.id}`

        let user = await Users.get(userID);

        if (user) {
            if (user.room) {
                await Rooms.removeUser(userID, user.room);
            }
            await Users.destroy(userID);
        }
    });
};

