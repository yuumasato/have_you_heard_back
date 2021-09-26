// Event: name
const Users = require('../server/users.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('name', (name) => {
        let userID = `user_${socket.id}`
        console.log('name: ' + name);

        if (Users.setName(`${userID}`, name)) {
            console.log(`${userID} set name to ${name}`);
            for (let r of socket.rooms) {
                socket.to(r).emit('chat message', `${socket.id} set name to ` + name);
            }
        } else {
            console.error(`Failed to set user ${userID} name to ` + name);
        }
    });
};


