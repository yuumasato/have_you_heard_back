// Redis service

// Stores the singleton redis connection for this instance
const assert = require("assert");
const { AbortError, AggregateError, ReplyError } = require("redis");
const { createClient } = require('redis');
const { promisify } = require("util");

const { runWithRetries } = require('./common');
const consts = require('./consts');
const debug = require('debug')('transactions');

module.exports = class RedisService {

    static instance = null;

    constructor() {
        this.pool = [];
    }

    static init(url) {
        if (RedisService.instance == null) {
            RedisService.instance = new RedisService();

            // Connection used for normal IO
            for (let i = 0; i < consts.NUM_REDIS_IO; i++) {
                let c = createClient(url);

                c.on('connect', function () {
                    console.log('redis IO connected');
                });

                c.on('error', function (error) {
                    console.log(error);
                });

                RedisService.instance.pool.push(c);
            }

            // Pub/Sub for socket.io adapter
            RedisService.instance.pub = createClient(url);
            RedisService.instance.sub = RedisService.instance.pub.duplicate();

            RedisService.instance.pub.on('connect', function () {
                console.log('redis publisher connected');
            });

            RedisService.instance.pub.on('error', function (error) {
                console.log(error);
            });

            RedisService.instance.sub.on('connect', function () {
                console.log('redis subscriber connected');
            });

            RedisService.instance.sub.on('error', function (error) {
                console.log(error);
            });
        }
    }

    static getIO(cb, errCB) {
        if (RedisService.instance == null) {
            throw 'Redis not initialized'
        }

        async function op() {
            let io = RedisService.instance.pool.pop();

            if (io) {
                debug('Got IO');
                return io;
            } else {
                throw 'IO not available';
            }
        }

        return runWithRetries(op, cb, errCB);
    }

    static returnIO(redisIO) {
        if (!RedisService.instance.pool.includes(redisIO)) {
            RedisService.instance.pool.push(redisIO);
            debug('Returned IO');
        }
    }
    static getSub() {
        if (RedisService.instance == null) {
            throw 'Redis not initialized'
        }
        return RedisService.instance.sub;
    }

    static getPub() {
        if (RedisService.instance == null) {
            throw 'Redis not initialized'
        }
        return RedisService.instance.pub;
    }

    static async get(redisIO, key) {
        const getAsync = promisify(redisIO.get).bind(redisIO);
        return getAsync(key);
    }

    static async set(redisIO, key, value) {
        const setAsync = promisify(redisIO.set).bind(redisIO);
        return setAsync(key, value);
    }

    static async del(redisIO, key) {
        const delAsync = promisify(redisIO.del).bind(redisIO);
        return delAsync(key);
    }

    static async keys(redisIO, pattern) {
        const keysAsync = promisify(redisIO.keys).bind(redisIO);
        return keysAsync(pattern);
    }

    static async exists(redisIO, key) {
        const existAsync = promisify(redisIO.exists).bind(redisIO);
        return existAsync(key);
    }

    static async multiExec(multi) {
        const multiExecAsync = promisify(multi.exec).bind(multi);
        return multiExecAsync();
    }
};
