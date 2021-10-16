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
                if (oldRoom) {
                    socket.leave(oldRoom.id);
                    console.log(`user ${user.id} left the room ${oldRoom.id}`);
                    if (oldRoom.users.length > 0) {
                        // Replace user IDs with complete user JSONs and send
                        Rooms.complete(oldRoom, (room) => {
                            console.debug(`room:\n` + JSON.stringify(room, null, 2));
                            io.to(room.id).emit('room', JSON.stringify(room));
                        }, (err) => {
                            console.error(err);
                        });
                    }
                }

                if (newRoom) {
                    // Replace user IDs with complete user JSONs and send
                    Rooms.complete(newRoom, (room) => {
                        console.debug(`room:\n` + JSON.stringify(room, null, 2));
                        io.to(room.id).emit('room', JSON.stringify(room));
                        console.log(`user ${user.id} joined room ${room.id}`);
                    }, (err) => {
                        console.error(err);
                    });
                }
            }, (err) => {
                // Rollback
                console.error(`Failed to add user ${userID} to room ${room.id}: ` + err);
                socket.leave(room.id);
                Rooms.destroy(room.id);
            });
        }, (err) => {
            console.error('Could not create new room: ' + err);
        });
    });
};

