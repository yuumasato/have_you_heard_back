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
    const path = require('path')
    const http = require('http');
    const app = express()
    const server = http.createServer(app);
    const io = require("socket.io")(server);

    app.get('/', (req, res) => {
        res.sendFile('index.html', { root: 'public'});
    });

    // Initialize events
    require("./events")(io);

    // use the cluster adapter
    io.adapter(createAdapter());

    // setup connection with the primary process
    setupWorker(io);
}
