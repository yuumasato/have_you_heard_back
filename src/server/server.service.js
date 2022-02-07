//class Server

const User = require('./user.class');
const Room = require('./room.class');
const consts = require('./consts');
const {Client} = require('pg');

const debug = require('debug')('have_you_heard');

module.exports = class Server {

    static instance = null;

    constructor(ex, io) {
        // express instance
        this.ex = ex;
        // socket.io instance
        this.io = io;

        this.rooms = {};
        this.users = {};

        this.headlines = {};
        this.headlines_offset = {};
        this.headlines_count = {};

        // maximum number of fetched headlines
        this.headlines_limit = consts.HEADLINES_LIMIT;

        // initialize headline stuff
        this.initHeadlines();
    }

    shuffle(array) {
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex != 0) {
            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }

    async connect_db() {
        var dbConfig;
        if (process.env.NODE_ENV === 'production') {
            dbConfig = {
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    sslmode: 'require',
                    rejectUnauthorized: false,
                }
            };
        } else {
            dbConfig = {
                connectionString: process.env.DATABASE_URL,
            };
        }

        const db = new Client(dbConfig);

        try {
            await db.connect();
            return db;
        } catch (err) {
            console.error("Failed to connect to the DB: " + err);
            throw err;
        }

    }

    async do_fetch(db, lang) {
        var offset = this.headlines_offset[lang];
        var limit = this.headlines_limit;

        var q = 'SELECT headline,link ' +
            `FROM ${lang}_headlines ` +
            'ORDER BY id ' +
            `LIMIT ${limit} ` +
            `OFFSET ${offset} `;

        return db.query(q)
            .then(res => {
                for (let row of res.rows) {
                    debug(JSON.stringify(row));
                }

                if ((offset + limit) > this.headlines_count[lang]) {
                    // If reached the end, go back to the beginning
                    this.headlines_offset[lang] = 0;
                } else {
                    // Otherwise move the offset further
                    this.headlines_offset[lang] = offset + limit;
                }
                this.headlines[lang] =
                    this.headlines[lang].concat(this.shuffle(res.rows));
            })
            .catch(err => {
                console.error(err);
                throw err;
            })
    }

    async fetchHeadlines(lang) {
        if (!consts.SUPPORTED_LANGUAGES.includes(lang)) {
            throw new Error(`Language ${lang} not supported`);
        }

        const db = await this.connect_db();
        await this.do_fetch(db, lang);

        // Super corner case: the last fetch got less than 3 headlines
        if (this.headlines[lang].length < 3) {
            await this.do_fetch(db, lang);
        }

        db.end();
    }

    async initHeadlines() {
        const db = await this.connect_db();
        var limit = this.headlines_limit;
        var promises = [];
        for (let lang of consts.SUPPORTED_LANGUAGES) {
            //this.headlines_mutex[lang] = new Mutex();
            let q = `SELECT COUNT(id) FROM ${lang}_headlines`;
            promises.push(db.query(q)
                .then(async (res) => {
                    let count = parseInt(res.rows[0]['count']);
                    this.headlines_count[lang] = count;

                    // If the number of rows is larger than the limit, choose
                    // starting offset randomly. Otherwise get all rows.
                    if (count > limit) {
                        this.headlines_offset[lang] = Math.floor(Math.random() *
                            (count - limit));
                    } else {
                        this.headlines_offset[lang] = 0;
                    }

                    this.headlines[lang] = [];

                    await this.do_fetch(db, lang);

                    debug(`headlines_offset: `, this.headlines_offset);
                    debug(`headlines_count: `, this.headlines_count);
                    console.log(`Initialized headlines for language ${lang}`);
                })
                .catch(err => {
                    console.error(`Failed to run query ${q}: ` + err);
                }));
        }

        try {
            await Promise.all(promises)
                .finally(() => db.end());
        } catch (err) {
            console.error("Failed to initialize headlines: " + err);
        }
    }

    async nextHeadlines(lang) {
        debug(JSON.stringify(this.headlines));
        if (this.headlines[lang].length >= 3) {
            return this.headlines[lang].splice(0, 3);
        } else {
            await this.fetchHeadlines(lang);
            return this.headlines[lang].splice(0, 3);
        }
    }

    static init(ex, io) {
        if (Server.instance == null) {
            Server.instance = new Server(ex, io);
        }
    }

    static getInstance() {
        return Server.instance;
    }

    static getIO() {
        return Server.instance.io;
    }

    static getExpress() {
        return Server.intance.ex;
    }

    // When the last user leaves the room, autodestruction is scheduled
    destroyRoom(roomID) {
        r = this.rooms[roomID];
        r.destroy();
        this.rooms.delete(roomID);
        console.log(`Room ${roomID} destroyed`);
    }

    roomAutodestroy(room) {
        // Set the timeout to destroy the room in 5 minutes (300000 ms)
        room.timeout = setTimeout(this.destroyRoom(room.id), 300000);
        console.log(`Autodestruct room ${room.id} in 5 minutes`);
    }

    // Create new user or recover user before autodestruction
    createUser(socket, userID) {
        let user = undefined;

        // Search for existing user with the given ID
        if (userID) {
            console.log(`User: ${userID} reconnected`);

            // TODO Search for user
            user = this.users[userID];

            if (user) {
                // Cancel autodestruction
                if (user.timeout) {
                    console.log(`Cancel autodestruction of user ${user.id}`);
                    clearTimeout(user.timeout);
                }

                // Remove user from previous room
                if (user.room) {
                    user.room.removeUser(userID);
                    // If it was the last user, set autodestruct
                    if (user.room.users.size <= 0) {
                        this.roomAutodestroy(user.room);
                    }
                }
            } else {
                // User existed, but was already destroyed
                user = new User(socket);
                user.id = socket.id;

                // Add the new user to the map
                this.users[user.id] = user;
            }
        } else {
            // New user
            console.log(`New user ${socket.id} connected`);
            user = new User(socket);
            user.id = socket.id;

            // Add the new user to the map
            this.users[user.id] = user;
        }

        return user;
    }

    getUser(userID) {
        return this.users[userID];
    }

    userAutodestruct(user) {
        // Set the timeout to destroy the user in 5 minutes (300000 ms)
        user.timeout = setTimeout(this.destroyUser(user.id), 300000);
        console.log(`Autodestruct user ${user.id} in 5 minutes`);
    }

    // When the user disconnects, autodestruction is scheduled
    destroyUser(userID) {
        // Remove the user from the room
        var user = this.users[userID];

        if (user) {
            if (user.room) {
                user.room.removeUser(userID);
                // If it was the last user, set autodestruct
                if (user.room.users.size <= 0) {
                    this.roomAutodestroy(user.room);
                }
            }
        }

        // TODO Use timeout before removing user when reconnect is implemented
        this.users.delete(userID);
        console.log(`User ${userID} destroyed`);
    }
};
