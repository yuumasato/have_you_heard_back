// Event: connection

const cookie = require('cookie');

// Initialize event listener
module.exports = function(io) {
    io.on('connection', function(socket) {

        const cookies = cookie.parse(socket.request.headers.cookie || "");

        var user = cookies.user;

        console.log(`The user ${socket.id} connected`);
        console.log(`User: ${user || 'not found'}`);

        // Initial name
        socket.name = 'user';

        // Remove socket from any room
        for (let r of socket.rooms) {
            socket.leave(r);
        }

        // Initially add socket to the lobby and inform interface
        socket.join('lobby');
        socket.emit('room', 'lobby');

        // Listen to these events
        require('./disconnect')(io, socket);
        require('./message')(io, socket);
        require('./user')(io, socket);
        require('./join')(io, socket);
        require('./name')(io, socket);

    });
};
