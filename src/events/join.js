// Event: join
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('join', async (number) => {
        console.log(`${socket.id} join: room ` + number);
        let userID = `user_${socket.id}`;
        let roomID = `room_${number}`;

        // Join the socket before adding to receive back the broadcast with the
        // state
        socket.join(roomID);
        Rooms.swapRooms(userID, undefined, roomID, (user, oldRoom, newRoom) => {
            let io = Server.getIO();

            // Update user in socket.io if the transaction was successful
            if (oldRoom && oldRoom.users.length > 0) {
                io.to(oldRoom.id).emit('room', JSON.stringify(oldRoom));
                console.log(`user ${user.id} left the room ${oldRoom.id}`);
            }

            if (newRoom) {
                io.to(newRoom.id).emit('room', JSON.stringify(newRoom));
                console.log(`user ${user.id} joined room ${newRoom.id}`);
            }
        }, (err) => {
            console.error(`Failed to add user ${userID} to room ${roomID}: ` + err);
            socket.leave(roomID);
        });
    });
};

