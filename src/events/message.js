// Event: message

// Initialize event listener
module.exports = function(server, socket) {
    socket.on('chat message', (msg) => {
        console.log(socket.name + ' message: ' + msg);

        for (let r of socket.rooms) {
            server.io.to(r).emit('chat message', socket.name + ': ' + msg);
        }
    });
};
