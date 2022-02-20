// The class is given when something requires this module

module.exports = class User {

    constructor(id) {
        this.name = "user";
        this.id = id;
        this.room = undefined;
        this.language = undefined;
    }

    wasInARoom() {
        if (this.room) {
            return this.room;
        } else if (this.disconnectionRoomID) {
            return this.disconnectionRoomID;
        } else {
            return undefined;
        }
    }

    wasInAGame() {
        if (this.game) {
            return this.game;
        } else if (this.disconnectionGameID) {
            return this.disconnectionGameID;
        } else {
            return undefined;
        }
    }

};

