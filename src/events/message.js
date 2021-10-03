// Event: 
const Server = require('../server/server.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('chat message', async(msg) => {
        let io = Server.getIO();
        let userID = `user_${socket.id}`
        let user = await Users.get(userID);
        if (user) {
            console.log(`${user.name}(${user.id}) message: ` + msg);
            io.to(user.room).emit('chat message', `${user.name}: ${msg}`);
        }
    });
};
