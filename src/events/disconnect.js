// Event: disconnect

// Initialize event listener
module.exports = function(io, socket) {
    console.log("Start disconnect event listener");
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
};

