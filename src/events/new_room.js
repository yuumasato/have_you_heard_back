// Event: new room
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('new room', async () => {
        let userID = `user_${socket.id}`;
        let room = await Rooms.create();
        if (!room) {
            return
        }

        console.log(`new room ${room.id}`);

        // Join the socket befor adding to receive back the broadcast with the
        // state
        socket.join(room.id);
        if (await Rooms.addUser(userID, room.id)) {
            console.log(`user ${userID} joined room ${room.id}`);
            // Rooms.addUser broadcasts to the room the new state
        } else {
            // Rollback
            console.error(`Failed to add user ${userID} to room ${room.id}`);
            socket.leave(room.id);
            await Rooms.destroy(room.id);
        }
    });
};

