// class Room

module.exports = class Room {

    constructor(roomID) {
        this.id = roomID;
        this.ownerID = undefined;
        this.users = [];
    }
};
