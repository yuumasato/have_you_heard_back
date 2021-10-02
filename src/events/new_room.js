// Event: new room
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('new room', async () => {
        let userID = `user_${socket.id}`;

        // Provide callback to call when the creation is successful
        Rooms.create((room) => {
            console.log(`new room ${room.id}`);

            // Join the socket before adding to receive back the broadcast with the
            // state
            socket.join(room.id);

            // Provide the callback to call when successful
            Rooms.addUser(userID, room.id, (user, oldRoom, newRoom) => {
                let io = Server.getIO();

                // Update user in socket.io if the transaction was successful
                if (oldRoom && oldRoom.users.length > 0) {
                    io.to(oldRoom.id).emit('room', JSON.stringify(oldRoom));
                }

                if (newRoom) {
                    io.to(newRoom.id).emit('room', JSON.stringify(newRoom));
                }

                console.log(`user ${user.id} joined room ${newRoom.id}`);
            }).catch ((err) => {
                // Rollback
                console.error(`Failed to add user ${userID} to room ${room.id}`);
                socket.leave(room.id);
                Rooms.destroy(room.id);
            });
        }).catch((err) => {
            console.error('Could not create new room');
        });
    });
};

