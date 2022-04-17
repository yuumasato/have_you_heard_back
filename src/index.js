const cluster = require('cluster');
const http = require("http");
const numCPUs = require('os').cpus().length;
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    require('dotenv').config()
    const httpServer = http.createServer();
    const numWorkers = (numCPUs > 3? 3: numCPUs);
    const PORT = process.env.PORT || 3000;

    // Setup sticky sessions
    setupMaster(httpServer, {
        loadBalancingMethod: "least-connection",
    });

    // Setup connections between the workers
    setupPrimary();

    // Needed for packets containing buffers
    // Node.js < 16.0.0
    cluster.setupMaster({
        serialization: "advanced",
    });

    console.log(`Listening on port ${PORT}`);
    httpServer.listen(PORT);

    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    console.log(`Worker ${process.pid} started`);

    require('dotenv').config()
    const express = require('express');
    const ex = express();
    const httpServer = http.createServer(ex);
    const io = require("socket.io")(httpServer);
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('./server/redis.service.js');

    // Connect node to redis to talk to other workers
    Redis.init({url: process.env.REDIS_URL} ||
        {host: 'localhost', port: 6379});
    const pubClient = Redis.getPub();
    const subClient = Redis.getSub();
    io.adapter(createAdapter(pubClient, subClient));

    // Setup connection with the primary process
    setupWorker(io);

    // Setup game server
    require('./server')(ex, io);
}
