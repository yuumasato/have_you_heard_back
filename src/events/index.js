// Events

/* Initialize events listener
 * For each event, add the require('new_event.js')
 * Implement the event in its file
 */
module.exports = function(io) {
    require('./connection')(io);
};
