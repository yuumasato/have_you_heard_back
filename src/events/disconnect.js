// Event: disconnect

// Initialize event listener
module.exports = function(server, socket) {
    socket.on('disconnect', () => {
        console.log(`user ${socket.id} disconnected`);
    });
};

