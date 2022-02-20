// Event: user

const Users = require('../server/users.service');
const Redis = require('../server/redis.service');
const Rooms = require('../server/rooms.service');
const Games = require('../server/games.service');
const debug = require('debug')('have_you_heard');


// Initialize event listener
module.exports = function(socket) {
    socket.on('user', async (originalID) => {
        console.log(`received user ID from ${socket.id}: ` + originalID);

        await Redis.getIO(async (redisIO) => {
            let currentID = `user_${socket.id}`;

            swapUser = false;
            let originalUser = undefined;
            if (originalID != undefined) {
                originalUser = await Users.get(redisIO, originalID);
                if (originalUser) {
                    swapUser = true;
                }
            }

            // Create user
            await Users.create(redisIO, currentID, async (user) => {
                if (user) {
                    socket.emit('user id', `${user.id}`);

                    // Listen to these events
                    require('./message')(socket);
                    require('./join')(socket);
                    require('./leave')(socket);
                    require('./new_room')(socket);
                    require('./name')(socket);
                    require('./language')(socket);
                    require('./start')(socket);
                    require('./vote_persona')(socket);
                    require('./answer')(socket);
                    require('./vote_answer')(socket);
                    require('./rematch')(socket);
                } else {
                    console.error('Could not create user');
                }
            }, (err) => {
                console.error('Could not create user: ' + err);
            });

            // Swap originalUser for currentUser everywhere
            if (swapUser) {
                console.error(`User ${originalID}:`);
                console.error(`user.room ${originalUser.room}`);
                console.error(`user.disconnectionRoomID ${originalUser.disconnectionRoomID}`);
                // Re join room if user was in it before having network issues
                roomIDToJoin = originalUser.wasInARoom();
                if (roomIDToJoin) {
                    socket.join(roomIDToJoin);
                    await Rooms.swapUsers(redisIO, roomIDToJoin, originalID, currentID, async (room) => {
                        if (room) {
                            debug(`room:\n` + JSON.stringify(room, null, 2));
                            console.log(`User ${originalID} was swapped by user ${currentID} in room ${roomIDToJoin}`);
                        }
                    }, (err) => {
                        console.error('Could not swap users in room: ' + err);
                    });
 
                    gameIDToJoin = originalUser.wasInAGame();
                    if (gameIDToJoin) {
                        game = await Games.get(redisIO, gameIDToJoin);
                        if (game) {
                            console.log(`Swapping players in game ${gameIDToJoin}: from ${originalID} to ${currentID}`);
                            await Games.swapPlayers(redisIO, gameIDToJoin, originalID, currentID, async (game) => {
                                if (game) {
                                    debug(`game:\n` + JSON.stringify(game, null, 2));
                                    socket.to(roomIDToJoin).emit('game', JSON.stringify(game))
                                    console.log(`Player ${originalID} was swapped by player ${currentID} in game ${gameIDToJoin}`);
                                }
                            }, (err) => {
                                console.error(`Failed to swap players ${originalID} for ${currentID}`);
                                console.error('Could not swap players in game: ' + err);
                            });
                        } else {
                            console.error(`Game ${gameIDToJoin} doesn't exist aymore`);
                        }
                    } else {
                        console.log(`User ${originalID} was not in a game`);
                    }
                } else {
                    console.log(`User ${originalID} was not in a room`);
                }
            }

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};
