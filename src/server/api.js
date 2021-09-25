// Server rest api

module.exports = function(server) {

    // server.ex is the express instance

    server.ex.get('/', (req, res) => {
        res.sendFile('index.html', { root: 'public'});
    });

};
