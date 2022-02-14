// Event: name
const Users = require('../server/users.service');
const consts = require('../server/consts');
const Redis = require('../server/redis.service');

// Initialize event listener
module.exports = function(socket) {
    socket.on('language', async (language) => {

        // TODO emit error
        if (!consts.SUPPORTED_LANGUAGES.includes(language)) {
            console.error(`Language ${language} not supported`);
            return;
        }

        let userID = `user_${socket.id}`
        console.log(`(${userID}) set language to ${language}`);

        await Redis.getIO(async (io) => {
            await Users.setLanguage(io, `${userID}`, language, (user) => {
                console.log(`User ${user.name} set language as ${language}`);
            }).catch((msg) => {
                console.error(`Failed to set user ${userID} language to ${language}: `
                              `${msg}`);
            });

            Redis.returnIO(io);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};


