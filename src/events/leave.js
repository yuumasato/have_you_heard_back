// Event: leave
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('leave', async () => {
        console.log(`${socket.id} leave room`);
        let userID = `user_${socket.id}`

        let user = await Users.get(userID);
        if (user) {
            if (user.room) {
                Rooms.removeUser(userID, user.room, async (user, oldRoom, newRoom) => {
                    let io = Server.getIO();
                    // Update user in socket.io if the transaction was successful
                    if (oldRoom) {
                        // Leave the socket before broadcasting his leave
                        socket.leave(oldRoom.id);
                        console.log(`User ${user.id} left the room ${oldRoom.id}`);
                        if (oldRoom.users.length > 0) {
                            // Replace user IDs with complete user JSONs and send
                            Rooms.complete(oldRoom, (room) => {
                                io.to(room.id).emit('room', JSON.stringify(room));
                            }, (err) => {
                                console.error(err);
                            });
                        }
                    }

                }, (err) => {
                    console.error(`Could not remove user ${userID} from room ${user.room}: ` + err);
                });
            } else {
                console.warn(`User ${user.id} was not in any room`);
            }
        }
    });
};


