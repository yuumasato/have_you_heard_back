const express = require('express');
const path = require('path')
const http = require('http');
const app = express()
const server = http.createServer(app);
const io = require("socket.io")(server);
//const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public'});
});

// Initialize events
require("./events")(io);

server.PORT = process.env.PORT || 3000

// Start server
server.listen(server.PORT, () => console.log(`Listening on ${ server.PORT }`));
