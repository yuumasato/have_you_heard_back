// Redis service
const debug = require('debug');

// Stores the singleton redis connection for this instance
const assert = require("assert");
const { AbortError, AggregateError, ReplyError } = require("redis");
const { createClient } = require('redis');
const { promisify } = require("util");

module.exports = class RedisService {

    static instance = null;

    constructor() {
    }

    static init(url) {
        if (RedisService.instance == null) {
            RedisService.instance = new RedisService();

            // Pub/Sub for socket.io adapter
            RedisService.instance.pub = createClient(url);
            RedisService.instance.sub = RedisService.instance.pub.duplicate();

            // Connection used for normal IO
            RedisService.instance.io = createClient(url);
            RedisService.instance.io.on('connect', function () {
                console.log('redis IO connected');
            });

            RedisService.instance.io.on('error', function (error) {
                console.log(error);
            });

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

    static getSub() {
        if (RedisService.instance == null) {
            RedisService.init(process.env.REDIS_URL ||
                              {host: 'localhost', port: 6379});
        }
        return RedisService.instance.sub;
    }

    static getPub() {
        if (RedisService.instance == null) {
            RedisService.init(process.env.REDIS_URL ||
                              {host: 'localhost', port: 6379});
        }
        return RedisService.instance.pub;
    }

    static getIO() {
        if (RedisService.instance == null) {
            RedisService.init(process.env.REDIS_URL ||
                              {host: 'localhost', port: 6379});
        }
        return RedisService.instance.io;
    }

    static async get(key) {
        let client = RedisService.getIO();
        const getAsync = promisify(client.get).bind(client);
        let result = await getAsync(key);
        debug(`Redis get ${key}: ${result}`);
        return result;
    }

    static async set(key, value) {
        let client = RedisService.getIO();
        const setAsync = promisify(client.set).bind(client);
        let result = await setAsync(key, value);
        debug(`Redis set ${key}: ${value}`);
        return result;
    }

    static async del(key) {
        let client = RedisService.getIO();
        const delAsync = promisify(client.del).bind(client);
        let result = await delAsync(key);
        debug(`Redis del ${key}: ${result}`);
        return result;
    }

    static async keys(pattern) {
        let client = RedisService.getIO();
        const keysAsync = promisify(client.keys).bind(client);
        let result = await keysAsync(pattern);
        debug(`Redis keys matching ${pattern}: ${result}`);
        return result;
    }

    static async exists(key) {
        let client = RedisService.getIO();
        const existAsync = promisify(client.exists).bind(client);
        let result = await existAsync(key);
        debug(`Redis exist key ${key}: ${result}`);
        return result;
    }
};
