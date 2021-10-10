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
        Rooms.swapRooms(userID, undefined, roomID, async (user, oldRoom, newRoom) => {
            let io = Server.getIO();

            // Update user in socket.io if the transaction was successful
            if (oldRoom) {
                socket.leave(oldRoom.id);
                console.log(`user ${user.id} left the room ${oldRoom.id}`);
                if (oldRoom.users.length > 0) {
                    // Replace user IDs with complete user JSONs and send
                    Rooms.complete(oldRoom, (room) => {
                        io.to(room.id).emit('room', JSON.stringify(room));
                    }, (err) => {
                        console.error(err);
                    });
                }
            }

            if (newRoom) {
                // Replace user IDs with complete user JSONs and send
                Rooms.complete(newRoom, (room) => {
                    io.to(room.id).emit('room', JSON.stringify(room));
                    console.log(`user ${user.id} joined room ${room.id}`);
                }, (err) => {
                    console.error(err);
                });
            }
        }, (err) => {
            console.error(`Failed to add user ${userID} to room ${roomID}: ` + err);
            socket.leave(roomID);
        });
    });
};

