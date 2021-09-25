const cluster = require('cluster');
const http = require("http");
const numCPUs = require('os').cpus().length;
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    const httpServer = http.createServer();
    const numWorkers = (numCPUs > 5? 5: numCPUs);
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

    const express = require('express');
    const ex = express()
    const httpServer = http.createServer(ex);
    const io = require("socket.io")(httpServer);
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');

    // Connect node to redis to talk to other workers
    const pubClient = createClient(process.env.REDIS_URL ||
                                   {host: 'localhost', port: 6379});
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));

    // Setup connection with the primary process
    setupWorker(io);

    // Setup game server
    const server = require('./server')(ex, io);
}
