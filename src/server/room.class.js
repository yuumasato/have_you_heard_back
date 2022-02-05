// class Room

module.exports = class Room {

    constructor(roomID, language) {
        this.id = roomID;
        this.ownerID = undefined;
        this.users = [];
        this.language = language;
    }
};
