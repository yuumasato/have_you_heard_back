// Server main file

const Server = require('./server.class');

/*
 * Instantiate the server and initialize events
 *
 * @param[ex] express server instance, the main REST API server
 * @param[io] socket.io instance
 *
 * */
module.exports = function (ex, io) {

    const server = new Server(ex, io);

    // Initialize server API
    require('./api')(ex);

    // Initialize events
    require('../events')(server);

    return server;
};
