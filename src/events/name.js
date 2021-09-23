// Event: name

// Initialize event listener
module.exports = function(io, socket) {
    socket.on('name', (name) => {
        console.log('name: ' + name);

        for (let r of socket.rooms) {
            io.to(r).emit('chat message', socket.name + ' set name to ' + name);
        }

        socket.name = name;
    });
};


