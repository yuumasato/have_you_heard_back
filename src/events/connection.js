// Event: connection

// Initialize event listener
module.exports = function(io) {
    console.log("Start connection event listener");
    io.on('connection', function(socket) {

        console.log('a user connected');

        // Listen to these events
        require('./disconnect')(io, socket);
        require('./message')(io, socket);

    });
};
