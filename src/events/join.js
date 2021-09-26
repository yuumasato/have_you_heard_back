// Event: join
const Rooms = require('../server/rooms.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('join', async (number) => {
        console.log(`${socket.id} join: room ` + number);
        let userID = `user_${socket.id}`;
        let roomID = `room_${number}`;


        // Join the socket befor adding to receive back the broadcast with the
        // state
        socket.join(roomID);
        if (await Rooms.swapRooms(userID, undefined, roomID)) {
            console.log(`user ${userID} joined room ${roomID}`);
            // Rooms.swapRooms broadcasts to the room the new state
        } else {
            console.error(`Failed to add user ${userID} to room ${roomID}`);
            socket.leave(roomID);
        }
    });
};

