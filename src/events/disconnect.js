// Event: disconnect
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Games = require('../server/games.service');

const Redis = require('../server/redis.service');
const debug = require('debug')('have_you_heard');

// Initialize event listener
module.exports = function(socket) {
    socket.on('disconnect', async () => {
        console.log(`socket ID ${socket.id} disconnected`);
        let userID = `user_${socket.id}`

        await Redis.getIO(async (redisIO) => {
            let user = await Users.get(redisIO, userID);
            if (user) {
                if (user.game) {

                    //TODO Update game state

                    user.disconnectionGameID = user.game;
                    await Games.removePlayer(redisIO, userID, user.game, async (game) => {
                        let io = Server.getIO();
                        // If the user was in the game
                        if (game) {
                            debug(`game:\n` + JSON.stringify(game, null, 2));
                            console.log(`user ${user.id} left the game ${game.id}`);
                        }
                    }, (err) => {
                        console.error(`Could not remove user ${userID} from game ${user.game}: ` + err);
                    });
                }

                if (user.room) {
                    user.disconnectionRoomID = user.room;
                    await Rooms.removeUser(redisIO, userID, user.room, async (result) => {
                        let io = Server.getIO();
                        let user = result["user"];
                        let oldRoom = result["oldRoom"];
                        // Update user in socket.io if the transaction was successful

                        console.log(`user ${user}`);
                        console.log(`oldRoom ${oldRoom}`);
                        console.log(`oldRoom ${oldRoom.users.length}`);

                        if (oldRoom) {
                            socket.leave(oldRoom.id);
                            console.log(`user ${user.id} left the room ${oldRoom.id}`);
                            if (oldRoom.users.length > 0) {
                                // Replace user IDs with complete user JSONs and send
                                Rooms.complete(redisIO, oldRoom)
                                .then((room)=> {
                                    debug(`room:\n` + JSON.stringify(room, null, 3));
                                    io.to(room.id).emit('room', JSON.stringify(room));
                                }, (err) => {
                                    console.error(err);
                                });
                            }
                        }

                    }, (err) => {
                        console.error(`Could not remove user ${userID} from room ${user.room}: ` + err);
                    });
                }
                // Every disconnect is a potential network error, let's not delete the user immediately
                await Users.delayedDestroy(redisIO, userID, async (user) => {
                    console.log(`user ${user.id} disconnected`);
                }, (err) => {
                    console.error(`Could not set disconnect expiry for user ${userID}: ` + err);
                });
            }

            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};

