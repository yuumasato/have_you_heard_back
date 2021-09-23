// Event: user

// Initialize event listener
module.exports = function(io, socket) {
    socket.on('user', (id) => {
        console.log('user: ' + id);

        // Send the socket id as the user ID
        if (id == "") {
            socket.emit('user id', `${socket.id}`);
        };
    });
};
