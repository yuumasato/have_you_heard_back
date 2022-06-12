// Event: vote persona
const Games = require('../server/games.service');
const Users = require('../server/users.service');
const Rooms = require('../server/rooms.service');
const Server = require('../server/server.service');
const Redis = require('../server/redis.service');

const debug = require('debug')('have_you_heard');

// TODO - modularize personas and multiplex with other languages
const pt_personas = [
    'Antivacina',
    'Bonosaro',
    'Eron Must',
    'Lulo',
    'Salvio',
    'Tia do Zap',
    'Tump',
    'Vegana'
]

//The maximum is exclusive and the minimum is inclusive
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

// Initialize event listener
module.exports = function(socket) {
    socket.on('vote persona', async function vote_persona_handler(persona) {
        let userID = `user_${socket.id}`;

        await Redis.getIO(async (redisIO) => {
            let user = await Users.get(redisIO, userID);

            // Check if the user exists
            if (!user) {
                console.error(`User ${userID} not found`);
                Redis.returnIO(redisIO);
                return;
            }

            // Check if the user is in a room
            if (!user.room) {
                console.error(`User ${userID} is not in a room`);
                Redis.returnIO(redisIO);
                return;
            }

            // Check if the game was already started
            if (!user.game) {
                console.error(`User is not in a game`);
                Redis.returnIO(redisIO);
                return;
            }

            // Provide the callback to call when successful
            await Games.votePersona(redisIO, userID, user.game, persona, async (retGame) => {
                console.log(`Received vote for ${persona}`);

                winner = Games.decidePersona(retGame);

                if (winner) {
                    await Games.announcePersona(redisIO, retGame, user.room, winner);
                } else {
                    console.log(`Game (${retGame.id}): Waiting for other players to vote`);
                }
            }, (err) => {
                console.error(`User ${userID} failed to vote for persona: ` + err);
            });

            // Unlock Redis IO connection
            Redis.returnIO(redisIO);
        }, (err) => {
            console.error('Could not get Redis IO: ' + err);
        });
    });
};

