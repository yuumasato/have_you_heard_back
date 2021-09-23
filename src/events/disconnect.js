// Event: disconnect

// Initialize event listener
module.exports = function(io, socket) {
    socket.on('disconnect', () => {
        console.log(`user ${socket.id} disconnected`);
    });
};

