var file = require('file-system');
var fs = require("fs");

const PrefixDefault = "anan ";
const MaxRoomsDefault = 2;

class Persistent{

    //List of server settings
    /**
     * @type {Server[]} 
     */
    list = [];
    filename = "Persistent.JSON";

    /**
     * @param {string} filename Name of JSON
     */
    fetch(filename = "Persistent.JSON") {

        //Read json
        var text = fs.readFileSync(filename);
        this.list = JSON.parse(text);

    }

    /**
     * @param {Server} server
     */
    //Add or update
    add(server){

        console.log(typeof list);
        //Check if there is any object with same id and delete
        for(var i = 0; i < this.list.length; i++)
            if(this.list[i].guildID == server.guildID)
                this.list.splice(i, 1);

        this.list.push(server);
        //Update JSON
        file.writeFile(this.filename, JSON.stringify(this.list));

    }

}

class Server{

    /**
     * @param {string} guildID 
     * @param {int} maxRooms 
     */
    constructor(guildID, maxRooms = MaxRoomsDefault, prefix = PrefixDefault){

        this.guildID = guildID;
        this.maxRooms = maxRooms;

    }

    guildID = "";
    maxRooms = MaxRoomsDefault;
    prefix = PrefixDefault;

}

module.exports = {
    Persistent:Persistent,
    Server:Server
}; 
