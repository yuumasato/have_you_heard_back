const PORT = process.env.PORT || 3000
const express = require('express');
const path = require('path')
const http = require('http');
const app = express()
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.get('/', (req, res) => {
       res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
	console.log('a user connected');
	socket.on('disconnect', () => {    console.log('user disconnected');  });
	socket.on('chat message', (msg) => {
		console.log('message: ' + msg);
		io.emit('chat message', msg);  
	});
});

server.listen(PORT, () => console.log(`Listening on ${ PORT }`));

