// Event: message

// Initialize event listener
module.exports = function(io, socket) {
    console.log("Start message event listener");
    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
        io.emit('chat message', msg);
    });
};
