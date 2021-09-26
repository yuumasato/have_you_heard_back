// Event: connection

// Initialize event listener
module.exports = function(io) {

    io.on('connection', function(socket) {

        console.log(`New connection ${socket.id}`);

        // Leave from all rooms
        for (let r of socket.rooms) {
            socket.leave(r);
        }

        // Listen to these events
        require('./disconnect')(socket);
        require('./user')(socket);
    });
};
