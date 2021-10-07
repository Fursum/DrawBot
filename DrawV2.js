const Discord = require('discord.js');
const { promisify } = require('util');

const Player = require('./Player');
const { Persistent, Server } = require('./Persistent')
const persistent = new Persistent();

const sleep = promisify(setTimeout);

const PrefixLengthMax = 5;
const DrawCategoryName = 'drawing room : ';
const DrawChannelName = 'drawing-room-';
const ChatRoomName = 'drawing-lobby';
const ResultsRoomName = 'game-results';
const DrawRoleName = 'drawing-draw-game-role-';
const IngameRole_MainName = 'drawing-in-game-';
const AnnounceRoleName = 'drawing-announce';

const ReadyEmoji = '✔️';
const AnnounceEmoji = '📣';
const JoinEmoji = '🖊️';
const AnonymousEmoji = '🕵️';
const RoundEmoji = '🔁';
const StartEmoji = '➡️';

const LogSize = 5;

const MaxRounds = 9;
const MinRounds = 1;

const client = new Discord.Client({ partials: ['MESSAGE', 'REACTION'] });
client.login('KEY GOES HERE');

client.on("ready", () => {

    console.log("->Logged in.")
    persistent.fetch();

})

//Holding multiple ongoing games
/**@type {GameManager[]} */
var gameManagers = [];

/** Action type for logging
 * @typedef Action
 * @type {Object}
 * @property {string} playerName
 * @property {string} actionName
 */

// Message Reaction
client.on('messageReactionAdd', async (reaction, user) => {

    if(user.bot) return;
    
    /** @type {Action} */
    var log = {
        playerName: "\u200B",
        actionName: "\u200B"
    };
    log.playerName = user.username;

    //Check for old messages
    if (reaction.partial) {
		// If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
		try {
			await reaction.fetch();
		} catch (error) {
			console.log('Something went wrong when fetching the message: ', error);
			// Return as `reaction.message.author` may be undefined/null
			return;
		}
    }
    
    try{

        //Announcement role is outside
        if(reaction.message.author.bot && reaction.emoji.name === AnnounceEmoji){

            var member = reaction.message.guild.members.cache.get(user.id);
            member.roles.add(await getAnnounceRole(reaction.message.guild))
                .catch(err => { console.log("Role couldnt be added to ") + user.username + ". Reason: " + err});

        }

        if(isOutsideofGame(reaction.message.channel.parentID))
            return;

        switch(reaction.emoji.name){

            /********
            * Ready *
            *********/
            case ReadyEmoji:
                if(!sendToPush(reaction.message))
                    console.log("Failed to push");
                break;

            /*******
            * Join *
            ********/
            case JoinEmoji:
                managerIndex = findManagerIndex(reaction.message.channel.id);
                if(managerIndex === -1) return;
                if(gameManagers[managerIndex].gameStarted) return;

                
                if(!gameManagers[managerIndex].addPlayer(user.id)){
                    reaction.message.channel.send(user.username + " is already in game.");
                    return;
                }

                //Check for start game button
                updateStartEmoji(gameManagers[managerIndex]);

                //Update settings embed
                log.actionName = "joined."
                gameManagers[managerIndex].settingsMessage.edit(generateLobbyEmbed(gameManagers[managerIndex], log));
                break;

            /********
            * Start *
            *********/
            case StartEmoji:

                managerIndex = findManagerIndex(reaction.message.channel.id);
                if(managerIndex === -1) return;
                if(gameManagers[managerIndex].gameStarted) return;

                //Check
                var member = reaction.message.guild.members.cache.get(user.id);  
                if(gameManagers[managerIndex].maxRound > gameManagers[managerIndex].playersArray.length 
                    && !member.hasPermission("ADMINISTRATOR")){

                    reaction.message.channel.send("Not enough players to start. " + 
                                                gameManagers[managerIndex].playersArray.length + "/" + gameManagers[i].maxRound)

                    //Remove start game button
                    if(gameManagers[managerIndex].playersArray.length < gameManagers[managerIndex].maxRound)
                        gameManagers[managerIndex].settingsMessage.reactions.cache.get(StartEmoji).remove()
                        .catch(error => console.error('Failed to remove reactions: ', error));
                    return;

                }
            
                gameManagers[managerIndex].setupGame();
                reaction.message.channel.send(user.username + " has started the game.");

                gameManagers[managerIndex].settingsMessage.reactions.removeAll()
                    .catch(error => console.error('Failed to clear reactions: ', error));

                //Update settings embed
                log.actionName = " started the game.";

                gameManagers[managerIndex].settingsMessage.edit(generateLobbyEmbed(gameManagers[managerIndex], log));

                reaction.remove();
                break;

            /*******
            * Anon *
            ********/
            case AnonymousEmoji:
                toggleAnonymous(reaction.message.channel.id,user.username);
                break;

            /********
            * Round *
            *********/
            case RoundEmoji:
                toggleRound(reaction.message.channel.id,user.username);
                //Check for start game button
                updateStartEmoji(gameManagers[managerIndex]);
                break;

        }


    }catch(error){

        console.log("Error in reaction: " + error);
        reaction.message.channel.send("Error: " + error);

    }

});

client.on('messageReactionRemove', async (reaction, user) => {

    if(user.bot) return;

    /** @type {Action} */
    var log = {
        playerName: '\u200B',
        actionName: '\u200B'
    };
    log.playerName = user.username;

    //Check for old messages
    if (reaction.partial) {
		// If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
		try {
			await reaction.fetch();
		} catch (error) {
			console.log('Something went wrong when fetching the message: ', error);
			// Return as `reaction.message.author` may be undefined/null
			return;
		}
    }
    
    try{


        //Announcement role is outside
        if(reaction.message.author.bot && reaction.emoji.name === AnnounceEmoji){

            member = reaction.message.guild.members.cache.get(user.id);
            member.roles.remove(await getAnnounceRole(reaction.message.guild))
                .catch(err => { console.log("Role couldnt be removed from ") + user.username + ". Reason: " + err});

        }

        if(isOutsideofGame(reaction.message.channel.parentID))
            return;

        switch(reaction.emoji.name){

            case JoinEmoji:
                managerIndex = findManagerIndex(reaction.message.channel.id);
                if(managerIndex === -1) return;
                if(gameManagers[managerIndex].gameStarted) return;

                if(!gameManagers[managerIndex].removePlayer(user.id)){
                    console.log("Player " + user.username + " is not in game.");
                    return;
                }

                //Remove start game button
                updateStartEmoji(gameManagers[managerIndex]);

                //Update embed
                log.actionName = " left the game."
                gameManagers[managerIndex].settingsMessage.edit(generateLobbyEmbed(gameManagers[managerIndex], log));
                break;

            /*******
            * Anon *
            ********/
            case AnonymousEmoji:
                toggleAnonymous(reaction.message.channel.id, user.username);
                break;

            /********
            * Round *
            *********/
            case RoundEmoji:
                toggleRound(reaction.message.channel.id, user.username);
                //Remove start game button
                updateStartEmoji(gameManagers[managerIndex]);
                break;

        }

    }catch(error){

        console.log("Error in reaction remove: " + error);
        reaction.message.channel.send("Error: " + error);

    }

});

// Message Start
client.on('message', message => {

    if(message.channel.type == "dm")
        return;

    try{

        //Ignore prefix inside game rooms and add ready check
        if(!message.author.bot && isGameplayMessage(message.channel.id)){
            message.react(ReadyEmoji);
            return;
        }

        var prefix = getServer(message.guild.id).prefix;

        //Do not read the message if it doesnt start with the prefix
        if(message.content.startsWith(prefix)){

            var arg = message.content.slice(prefix.length).toLowerCase();
            message.content = message.content.toLowerCase();

            switch(arg){

                //Closes game room and the manager
                case "close":
                    message_Close(message); break;
                
                case "invite":
                    message.channel.send("Join the server at : https://discord.gg/UDuNXNC");
                    break;

                case "help":
                    message_Help(message); break;
                    
                case "debug":
                    console.log(gameManagers); 
                    for(const i in gameManagers)
                        console.log(gameManagers[i].playersArray);
                    break;

                case "clear":
                    if(!message.member.hasPermission('ADMINISTRATOR'))
                        break;

                    name = "drawing";
                    deleteRoles(message.guild, name)
                    deleteChannels(message.guild, name)
                
                    for(var i = 0; i < gameManagers.length; i++)
                        if(message.guild.id === gameManagers[i].gameGuildID)
                            gameManagers.splice(i, 1);

            }

            //Longer commands arent inside switch case
            if(arg.startsWith("make") && isOutsideofGame(message.channel.parentID)){

                const name = message.content.slice((prefix + "make ").length);
                makeNewGame(name, message.guild.id)
                    .then( channelID => { message.channel.send("Created a new game room: <#" + channelID + ">"); } )
                    .catch( err => message.channel.send("Error during creation. " + err) )

            }

            else if(arg.startsWith("maxroom ") && message.member.hasPermission('ADMINISTRATOR')){

                var roomNumber = parseInt(arg.slice("maxroom ".length));
                
                if (isNaN(roomNumber)) {

                    message.channel.send("Enter a number for room limit.")
                    return;

                }
                
                if (roomNumber > 1) {

                    var server = getServer(message.guild.id);
                    server.maxRooms = roomNumber;
                    persistent.add(server);
                    message.channel.send("Room limit is set to: " + getServer(guildID).maxRooms);   

                } else
                    channel.send("Enter a number greater than 1.");
                    
            }

            else if((arg.startsWith("prefix ") || arg.startsWith("prefixs ")) && message.member.hasPermission('ADMINISTRATOR')){

                var space = false;
                if(arg.startsWith("prefixs "))
                    space = true;

                if(space)
                    arg = arg.slice("prefixs ".length);
                else arg = arg.slice("prefix ".length);

                if(arg.includes("\"") || arg.includes("\\")){

                    message.channel.send("Prefix cannot include \" or \\\\ .");
                    return;

                }

                if(arg.length > PrefixLengthMax){

                    message.channel.send(`Prefix length must be shorter than ${PrefixLengthMax}.`);
                    return;

                }

                if(space)
                    arg += " ";

                var server = getServer(message.guild.id);
                server.prefix = arg;
                persistent.add(server);

                message.channel.send("Prefix is set to `" + arg + "`");

            }

        }


    }catch(error){

        console.log("Error on message: " + error);
        message.channel.send("Error: " + error);

    }

});

/***************************************
*                                      *
*           Global Functions           *
*                                      *
****************************************/

function getServer(guildID){

    for(var i = 0; i < persistent.list.length; i++)
        if(persistent.list[i].guildID == guildID)
            return persistent.list[i];

    var server = new Server(guildID);
    persistent.add(server);

    return server;

}

//Send message to the respective game manager
function sendToPush(message){
    
    for(i in gameManagers)
    
        if(gameManagers[i].gameCategoryID === message.channel.parentID 
            && gameManagers[i].pushContent(message)){
            return true;
        }

    return false;

}

//Makes a new game manager with a new category and channel
async function makeNewGame(categoryName, guildID){

    var gameGuild = client.guilds.cache.find(element => element.id === guildID);

    //Check if guild has a game room already
    for(var i = 0; i < gameManagers.length; i++)
        if(gameManagers[i].gameGuildID === guildID)
            throw("Server already has a game room.")

    //Parent category4
    var category = await gameGuild.channels.create(DrawCategoryName + categoryName, { 
        type: 'category', 
        reason: 'Channel added for drawing game.'});

    //Disable reactions for safety
    category.createOverwrite(gameGuild.roles.everyone, {
        ADD_REACTIONS: false
    })

    category.createOverwrite(client.user.id, {
        SEND_MESSAGES: true,
        VIEW_CHANNEL: true,                   
        WRITE: true,
        MANAGE_CHANNELS: true,
    })

    //Unique role for category
    var role = await gameGuild.roles.create({
        data: {
            name: IngameRole_MainName + categoryName,
            hoist: true
        },
        reason: 'Role added for drawing game.'});

    //Main chat room for the game
    var mainChat = await gameGuild.channels.create(ChatRoomName, { 
        type: 'text',
        parent: category, 
        reason: 'Channel added for drawing game.' });

    var manager = new GameManager(mainChat, role);

    //Ready role
    manager.gameRole_Ready = await gameGuild.roles.create({
        data: {
            name: "drawing-" + categoryName + "-Ready",
            color: 'GREEN',
        },
        reason: 'Ready role added for drawing game.'});

    //Check for results channel, make one if it does not exist
	var resultsRoom;
    suitableRoom = gameGuild.channels.cache.find(element => element.name === ResultsRoomName);
    if(suitableRoom === undefined){
		resultsRoom = await gameGuild.channels.create(ResultsRoomName, {
            type: 'text',
            permissionOverwrites: [{
                id: gameGuild.id,
                deny: ['SEND_MESSAGES'],
            }],
			reason: 'Channel added for drawing game results.'
        });
		
    } else resultsRoom = suitableRoom;
    
    resultsRoom.createOverwrite(client.user.id, {
        SEND_MESSAGES: true,
        VIEW_CHANNEL: true,                   
        WRITE: true
    })

    manager.gameResultsRoomID = resultsRoom.id;
    manager.gameName = categoryName;

    //Send the join embed
    var settingsMessage = await mainChat.send(generateLobbyEmbed(manager));
    settingsMessage.react(JoinEmoji)
        .then(() => { settingsMessage.react(AnonymousEmoji); })
        .then(() => { settingsMessage.react(RoundEmoji); })
    manager.settingsMessage = settingsMessage;

    var announce = await getAnnounceRole(gameGuild)
    mainChat.send("<@&" + announce + "> come join this lobby!")

    gameManagers.push(manager);

    return mainChat.id;

}

function findManagerIndex(channelID){
    var i = 0;
    for(i in gameManagers){
        if(gameManagers[i].gameCommandChannelID === channelID)
            return i;}

    return -1;

}

function isOutsideofGame(categoryID){

    for(i in gameManagers)
        if(gameManagers[i].gameCategoryID === categoryID)
            return false;

    return true;

}

function isGameplayMessage(channelID){

    for(i in gameManagers)
        for(j in gameManagers[i].playersArray)
            if(gameManagers[i].playersArray[j].assignedRoomID === channelID)
                return true;

    return false;

}

function removeChannel(guild, channelID){

    channel = guild.channels.cache.find(element => element.id === channelID)

    if(channel === undefined)
        return;

    channel.delete();

}

async function removeRole(guild, roleID){

    role = guild.roles.cache.find(element => element.id === roleID)
    
    if(role !== undefined)
        role.delete();
    
}

function deleteChannels(guild, channelName){

    toBeDeleted = guild.channels.cache.filter(element => element.name.includes(channelName));

    toBeDeleted.forEach(channel => {

        channel.delete({reason: "Deleted by user command."});

    });

}

async function deleteRoles(guild, roleName){

    toBeDeleted = guild.roles.cache.filter(element => element.name.includes(roleName));

    toBeDeleted.forEach(role => {

        role.delete({reason: "Deleted by user command."});

    });

}

//Makes a temporary room
async function createInputChannel(gameGuildID, gameCategoryID, index){

    var gameGuild = client.guilds.cache.find(element => element.id === gameGuildID);
    var temp = await gameGuild.channels.create(DrawChannelName + index, { 
        type: 'text',
        parent: gameGuild.channels.cache.find(element => element.id === gameCategoryID),
        reason: 'Channel added for drawing game.' });
        
    return temp;

}

//Makes a temporary role
async function createInputRole(gameGuildID, index){

    var gameGuild = client.guilds.cache.find(element => element.id === gameGuildID);
    var temp = await gameGuild.roles.create({
        data: {
            name: DrawRoleName + index,
        },
        reason: 'Role added for drawing game.'});

    return temp;

}

function shuffle(array) {

    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;

    }

    return array;

}


async function getAnnounceRole(guild){

    //Find role or create one
    var role;
    role = guild.roles.cache.find(element => element.name === AnnounceRoleName);
    if(role === undefined){
		role = await guild.roles.create({
            data: {
                name: AnnounceRoleName,
                mentionable: true
            },
			reason: 'Role added for drawing game announcements.'
        });
        
    }

    return role;

}


/**
 * @param {GameManager} gameManager
 * @param {Action} action
 */
function generateLobbyEmbed(gameManager, action = undefined){

    var playerCount = gameManager.playersArray.length;
    var maxRound = gameManager.maxRound;
    var prefix = getServer(gameManager.gameGuildID).prefix;

    var playerString = "";

    for(var i = 0; i < playerCount; i++)
        playerString += '👤';

    for(var i = 0; i < maxRound - playerCount; i++)
        playerString += '⭕';

    const Embed = new Discord.MessageEmbed();
    Embed.setTitle("Game Room: " + gameManager.gameName +" | Welcome to the lobby!")
        .setColor('BLUE')
        .addFields(
            {name: "Players:", value: playerString},
            {name: "Rounds:", value: maxRound + ((maxRound > playerCount) ? " ❗" : ""), inline: true},
            {name: "Anonymous:", value: (gameManager.anonymous) ? "Yes" : "No", inline: true},
            {name: "Game Started:", value: (gameManager.gameStarted) ? "Yes" : "No", inline: true}
        )
        .setDescription("For help, use: " + prefix + " help.\n" +
                        "Click " + JoinEmoji + " to join." + 
                        ((maxRound <= playerCount) ? "\nClick " + StartEmoji + " to start." : ""));
    // Logging
    if (action != undefined) {
        gameManager.LogField.pop();
        gameManager.LogField.unshift(action)
    }

    for(var i in gameManager.LogField)
        Embed.addField(gameManager.LogField[i].playerName, gameManager.LogField[i].actionName);

    // Logging End
    if(maxRound > playerCount){
        Embed.addField("❗ Problems:", "Not enough players for " + maxRound + " rounds. Add more players or reduce the round number.")
        Embed.setColor('RED');
    }

    else if(!gameManager.gameStarted)
        Embed.setColor('GREEN')

    else Embed.setColor('GREY')

    return Embed;

}

function toggleAnonymous(channelID, username){

    managerIndex = findManagerIndex(channelID);
        if(managerIndex === -1) return;
        if(gameManagers[managerIndex].gameStarted) return;

    gameManagers[managerIndex].anonymous = !gameManagers[managerIndex].anonymous;

    //Update settings
    /** @type {Action} */
    var log = {
        playerName: '\u200B',
        actionName: '\u200B'
    };
    log.playerName = username;
    log.actionName = "toggled anonymous.";
    gameManagers[managerIndex].settingsMessage.edit(generateLobbyEmbed(gameManagers[managerIndex], log))

}

function toggleRound(channelID, username){

    var managerIndex = findManagerIndex(channelID);
        if(managerIndex === -1) return;
        if(gameManagers[managerIndex].gameStarted) return;

    var round = gameManagers[managerIndex].maxRound;

    round += 2;
    if(round > MaxRounds)
        round = round % MaxRounds + MinRounds;

    gameManagers[managerIndex].maxRound = round;

    //Update settings
    /** @type {Action} */
    var log = {
        playerName: '\u200B',
        actionName: '\u200B'
    };
    log.playerName = username;
    log.actionName = "toggled round.";
    gameManagers[managerIndex].settingsMessage.edit(generateLobbyEmbed(gameManagers[managerIndex], log))

}

//Remove or add start emoji
function updateStartEmoji(gameManager){

    if(gameManagers[managerIndex].playersArray.length < gameManagers[managerIndex].maxRound){

        var reaction = gameManagers[managerIndex].settingsMessage.reactions.cache.get(StartEmoji)
        if(reaction !== undefined)
            reaction.remove()
                .catch(error => console.error('Failed to remove reactions: ', error));

    }

    else gameManagers[managerIndex].settingsMessage.react(StartEmoji);

}

function message_Close(message){

    var i = findManagerIndex(message.channel.id);
    //Check if its sent in a game channel
    if(i === -1 || gameManagers[i].gameCommandChannelID !== message.channel.id)
        return;

    //Check if the sender is a player or an admin
    if(message.member.hasPermission('ADMINISTRATOR') || message.author.bot){

        gameManagers[i].closeGame();
        gameManagers.splice(i, 1);

    }

}

/** @param {Discord.Message} message */
function message_Help(message){

    var prefix = getServer(message.guild.id).prefix;

    const helpEmbed = new Discord.MessageEmbed()
	    .setColor('#0099ff')

    //Context sensitive help?
    var title = 'Help | ';

    //In game
    if(!isOutsideofGame(message.channel.parentID)){

        title += 'Lobby'
        helpEmbed.addFields(
            {name: 'How to play?', value: 'Follow the prompt, send the message to your private channel, click the emoji to confirm.'},
            {name: 'How to send images?', value: 'Create an image using your preferred software, then paste a link or image directly to your private channel.'},
            {name: 'Commands:', value:  prefix + 'close | Requires admin'})

    }

    //General
    else{

        title += 'General';
        helpEmbed.addFields(
            {name: 'General Commands:', value:  prefix + 'make    : Creates a game lobby' + '\n' +
                                                prefix + 'invite  : Invite link' + '\n'},
            {name: 'Admin Commands:',   value:  prefix + 'clear   : Deletes game related stuff' + '\n' +
                                                prefix + 'prefix  : Changes server prefix (No space at tail)' + '\n' +
                                                prefix + 'prefixs : Changes server prefix (Space at tail)' + '\n' +
                                                prefix + 'maxroom : Changes the room limit for server'})

    }

    helpEmbed.setTitle(title);
    message.channel.send(helpEmbed);

}

class GameManager{

    gameName = "";
    gameGuildID = "";
    gameCommandChannelID = "";
    gameImageRoomID = "";
    gameResultsRoomID = "";
    gameCategoryID = "";
    gameRole_Main = new Discord.Role();
    gameRole_Ready = new Discord.Role();
    gameStarted = false;
    settingsMessage = new Discord.Message();
    currentRound = 0;

    // Logging
    /**@type {Action[]} */
    LogField = [];

    //Settings
    anonymous = true;
	maxRound = 3;

    /**@type {Player[]}*/
    playersArray = [];

    /**@type {string[]}*/
    roundsContents = [];
	
    constructor(commandChannel, _gameRole_Main){

        for (var i = 0; i < LogSize; i++)
            this.LogField.push({playerName: '\u200B', actionName: '\u200B'})

        this.gameCommandChannelID = commandChannel.id;
        this.gameGuildID = commandChannel.guild.id;
        this.gameRole_Main = _gameRole_Main;
        this.gameCategoryID = commandChannel.parentID;

    }

    //Checks ready state of every player in game
    readyCheck(){
        
        for(const i in this.playersArray)
            if(this.playersArray[i].readyState === false)
                return false;

        return true;

    }

    //End game result posts and cleanup
    finalizeGame(){

        console.log("GAME END");

        var endContent = []
        var endContentAuthor = []
        var channel = this.gameRole_Main.guild.channels.cache.get(this.gameResultsRoomID);
        /** @type {import('discord.js').ColorResolvable} */
        let color;

        channel.send("---------------------------------------\n\n" +
                    "     👑Game Room:   " + this.gameName +"\n\n" +
                    "---------------------------------------\n")

        for(i in this.playersArray){

            //Reset arrays
            endContent = [];
            endContentAuthor = [];

            //Embed color
            switch(i % 3){
                case 0:
                    color = 'YELLOW'; break;
                case 1:
                    color = 'BLUE'; break;
                case 2:
                    color = 'RED'; break;


            }

            for(const j in this.playersArray[i].contentArray){

                var index = i - j;
                while(index < 0) index += this.playersArray.length;
                endContent.push(this.playersArray[index % this.playersArray.length].contentArray[j]);
                endContentAuthor.push(this.playersArray[index % this.playersArray.length].playerID);

            }

            let player = this.gameRole_Main.guild.members.cache.get(endContentAuthor[0])
            const firstEmbed = new Discord.MessageEmbed();

            firstEmbed.setColor(color);
            firstEmbed.setTitle("Prompt  #" + (i- -1)); // - - > +, we need int, not string
            firstEmbed.setDescription(endContent[0])

            if (!this.anonymous)
                firstEmbed.setFooter(player.displayName, player.user.avatarURL());

            if(i != 0)channel.send("``` ```");
            channel.send(firstEmbed);

            for(var j = 1; j < endContent.length; j++){

                const embed = new Discord.MessageEmbed();
                embed.setColor(color);
                player = this.gameRole_Main.guild.members.cache.get(endContentAuthor[j]);

                //Drawing result
                if(j % 2 === 1){
                    
                    embed.setTitle('Drawing')
                        .setURL(endContent[j])
                        .setImage(endContent[j])

                    if (!this.anonymous)
                        embed.setFooter(player.displayName, player.user.avatarURL());

                }

                //Guess result
                else{

                    embed.setTitle('Guess')
                    embed.setDescription(endContent[j])

                    if (!this.anonymous)
                        embed.setFooter(player.displayName, player.user.avatarURL());


                }

                channel.send(embed);
                            
            }

        }

        //Close game from lobby because theres access to game managers array outside of this class
        channel = this.gameRole_Main.guild.channels.cache.get(this.gameCommandChannelID);
        channel.send(getServer(channel.guild.id).prefix + "close");

    }

    advanceRound(){

        if(this.currentRound < this.maxRound - 1){

            for(const i in this.playersArray){
                this.roundsContents[i] = this.playersArray[i].contentArray[this.currentRound];
                this.gameRole_Main.guild.members.cache.get(this.playersArray[i].playerID)
                .roles.remove(this.gameRole_Ready);
            }
			
            //Shift contents in a circle
            var temp = this.roundsContents.shift();
            this.roundsContents.push(temp);

            //When the players are more than the round number, send the second image to the second next room instead

            this.currentRound++;
            for(const i in this.playersArray)
                this.playersArray[i].readyState = false; 
                
            //Send respective content messages to their channel
            this.SendMessages();
        }

        else this.finalizeGame();

    }

    /**
     * @param {Discord.Message} message
     */
    pushContent(message){

        for(const i in this.playersArray)
            if (this.playersArray[i].assignedRoomID === message.channel.id) {
                //Text round
                if(this.currentRound % 2 === 0 && message.attachments.size == 0){

                    console.log("Text content pushed");
                    this.playersArray[i].contentArray[this.currentRound] = message.content;
                    this.makeReady(this.playersArray[i].playerID);
                    return true;

                }

                //Image round
                else{
 
                    message.attachments.forEach(element =>{

                        console.log("image sent");
                        this.playersArray[i].contentArray[this.currentRound] = element.url;
                        this.makeReady(this.playersArray[i].playerID);

                    });
                    
                    if(message.attachments.size > 0) return true;

                }

            } 
            
        console.log(message.attachments);

        message.channel.send(this.currentRound % 2 === 0 ? "Send a text message." : "Send an image file.");
        console.log("Wrong message " + message.member.id);
        console.log("Player array : ");
        console.log(this.playersArray)
        return false;
        
    }

    async SendMessages(){

        for(const i in this.playersArray){

            var channel = this.gameRole_Main.guild.channels.cache.get(this.playersArray[i].assignedRoomID);
            channel.send("-----------ROUND " + this.currentRound + "-----------")
            
            if(this.currentRound % 2 === 0){
                const embed = new Discord.MessageEmbed();
                embed.setTitle('Drawing')
                        .setURL(this.roundsContents[i])
                        .setImage(this.roundsContents[i])
                channel.send("Describe this image. " + "<@" + this.playersArray[i].playerID + ">");
                channel.send(embed);
            }
            else{
                channel.send("```" + this.roundsContents[i] + "```");
                channel.send("Draw this prompt. " + "<@" + this.playersArray[i].playerID + ">")
            }

        }

    }

    /**
     * @param {string} playerID
     */
    makeReady(playerID){

        for(const i in this.playersArray)
            if(this.playersArray[i].playerID === playerID && !this.playersArray[i].readyState){
                this.playersArray[i].readyState = true;
                //Add ready role
                this.gameRole_Main.guild.members.cache.get(this.playersArray[i].playerID)
                .roles.add(this.gameRole_Ready)
                .then( () => {
                    if (this.readyCheck())
                        this.advanceRound()});
                console.log(this.playersArray[i].playerID + " ready")
            }

    }

    /**
     * @param {string} playerID
     */
    addPlayer(playerID){

        var player = this.gameRole_Main.guild.members.cache.get(playerID);
        for(const i in this.playersArray)
            if(this.playersArray[i].playerID === playerID)
                return false;

        player.roles.add(this.gameRole_Main);
        this.playersArray.push(new Player(playerID));
        return true;

    }

    /**
     * @param {string} playerID
     */
    removePlayer(playerID){

        var player = this.gameRole_Main.guild.members.cache.get(playerID);
        for(const i in this.playersArray)
            if(this.playersArray[i].playerID === playerID){

                player.roles.remove(this.gameRole_Main);
                this.playersArray.splice(i, 1);
                return true;

            }
                
        return false;

    }

    async setupGame(){

        this.currentround = 0;
        this.gameStarted = true;

        //Make player classes and get the players with roles in it
        var readyPlayers = this.gameRole_Main.guild.members.cache.filter(member_i => member_i.roles.cache.has(this.gameRole_Main.id));

        for(i in readyPlayers)
            this.playersArray.push(new Player(readyPlayers[i].id))

        this.playersArray = shuffle(this.playersArray);
        
        //Individual rooms and roles
        for(var i = 0; i < this.playersArray.length; i++){

            this.playersArray[i].readyState = false;

            //Make temporary rooms and roles
		    var tempRoom = await createInputChannel(this.gameGuildID, this.gameCategoryID, i + 1);
            var tempRole = await createInputRole(this.gameGuildID, i + 1);
			
            this.playersArray[i].assignedRoomID = tempRoom.id;
            this.playersArray[i].assignedRoleID = tempRole.id;
            this.gameRole_Main.guild.members.cache.get(this.playersArray[i].playerID)
                .roles.add(tempRole);

            // Disallow Everyone to see channel
            tempRoom.createOverwrite(this.gameRole_Main.guild.roles.everyone, {
                SEND_MESSAGES: false,
                VIEW_CHANNEL: false,                   
                WRITE: false
            })

            //Explicitely allow the role to see and write channel
            tempRoom.createOverwrite(tempRole, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true
            });

            tempRoom.createOverwrite(this.gameRole_Main.guild.roles.everyone, {
                SEND_MESSAGES: false,
                VIEW_CHANNEL: false,                   
                WRITE: false
            })
            
        }
        // burada niye sleep(1000) var @Fursum
        sleep(1000).then(() => {
            for(i in this.playersArray){
                
                var channel = this.gameRole_Main.guild.channels.cache.get(this.playersArray[i].assignedRoomID);
                channel.send("-----------" + "START" + "-----------");
                channel.send("Write a prompt for people to draw. <@" + this.playersArray[i].playerID + ">");

            }
        });

    }

    closeGame(){

        var guild = this.gameRole_Main.guild;

        //Remove assigned roles
        for(const i in this.playersArray){
            removeChannel(guild, this.playersArray[i].assignedRoomID)
            removeRole(guild, this.playersArray[i].assignedRoleID)
                .catch(err => {console.log(err)});
        }
        removeChannel(guild, this.gameCommandChannelID)
        removeRole(guild, this.gameRole_Main.id)
            .catch(err => {console.log(err)});
        removeRole(guild, this.gameRole_Ready.id)
            .catch(err => {console.log(err)});
        removeChannel(guild, this.gameCategoryID)    

    }

}

