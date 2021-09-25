// Event: name

// Initialize event listener
module.exports = function(server, socket) {
    socket.on('name', (name) => {
        console.log('name: ' + name);

        for (let r of socket.rooms) {
            server.io.to(r).emit('chat message', socket.name + ' set name to ' + name);
        }

        socket.name = name;
    });
};


