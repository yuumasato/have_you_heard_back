// Event: user

// Initialize event listener
module.exports = function(server, socket) {
    socket.on('user', (id) => {
        console.log('user: ' + id);

        // Send the socket id as the user ID
        if (id == "") {
            socket.emit('user id', `${socket.id}`);
        };
    });
};
