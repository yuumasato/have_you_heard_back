// Event: join

// Initialize event listener
module.exports = function(server, socket) {
    socket.on('join', (room) => {
        console.log('join: ' + room);

        for (let r of socket.rooms) {
            socket.leave(r);
            server.io.to(r).emit('chat message', `user ${socket.name} left`);
        }

        socket.join(room);
        socket.to(room).emit('chat message', `user ${socket.name} joined`);
        socket.emit('room', room);
    });
};

