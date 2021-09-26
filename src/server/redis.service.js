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

            RedisService.instance.pub.on('connect', function () {
                console.log('redis connected');
            });

            RedisService.instance.pub.on('error', function (error) {
                console.log(error);
            });

            RedisService.instance.sub.on('connect', function () {
                console.log('redis connected');
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

        try {
            let result = await getAsync(key);
            debug(`Redis get ${key}`);
            return result;
        } catch (e) {
            console.error(e);
        }
    }

    static async set(key, value) {
        let client = RedisService.getIO();
        const setAsync = promisify(client.set).bind(client);

        try {
            let result = await setAsync(key, value);
            debug(`Redis set ${key} : ${value}`);
            return result;
        } catch (e) {
            console.error(e);
        }
    }

    static async del(key) {
        let client = RedisService.getIO();
        const delAsync = promisify(client.del).bind(client);

        try {
            let result = await delAsync(key);
            debug(`Redis del ${key}`);
            return result;
        } catch (e) {
            console.error(e);
        }
    }

    static async keys(pattern) {
        let client = RedisService.getIO();
        const keysAsync = promisify(client.keys).bind(client);

        try {
            let result = await keysAsync(pattern);
            debug(`Redis keys matching ${pattern}`);
            return result;
        } catch (e) {
            console.error(e);
        }
    }
};
