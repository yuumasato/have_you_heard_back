// Event: user

const Users = require('../server/users.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('user', (id) => {
        //TODO for now, we ignore the provided ID and always create a new user
        console.log(`received user ID from ${socket.id}: ` + id);

        // Send the socket id as the user ID
        //if (id == "") {
        //    socket.emit('user id', `user_${socket.id}`);
        //    id = socket.id;
        //};

        // Create user or recover on reconnection
        Users.create(`user_${socket.id}`);
        socket.emit('user id', `user_${socket.id}`);

        // Listen to these events
        require('./message')(socket);
        require('./join')(socket);
        require('./new_room')(socket);
        require('./name')(socket);
    });
};
