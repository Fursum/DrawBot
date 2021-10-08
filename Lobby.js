const Discord = require('discord.js');
const path = require('path');
const https = require('https');
const rootCas = require('ssl-root-cas').create();

const FlamingText = require('./functionality/FlameText.js');
const { Persistent, Server } = require('./functionality/Persistent')
const persistent = new Persistent();

//This is a certificate for gif maker site
rootCas.addFile(path.resolve(__dirname, './intermediate.pem'));
https.globalAgent.options.ca = rootCas;

const SECONDARY_PREFIX = "among ";

const AnnounceRoleName = "among-us-announce";
const AnnounceChannelName = "announce";
const ControlChannelName = "test";

const AnnounceEmoji = "flushed_us";
const JoinEmoji = "✅";
const MaybeEmoji = "❓";
const RejectEmoji = "❌";
const MuteEmoji = "🔇";

/** @type {Discord.TextChannel} */
var AnnounceChannel;
/** @type {Discord.Message} */
var LobbyMessage;
/** @type {Discord.Message[]} */
var ToBeDeleted = [];
var lobbyTime = "";
var lobbyActive = false;

/** @type {Array<Discord.GuildMember[]>} */
var PlayerList = [];
ClearList();

/** @type {Discord.Collection<string, Discord.VoiceChannel>} */
var VoiceChannels;

const client = new Discord.Client({ partials: ['MESSAGE', 'REACTION'] });
client.login('KEY GOES HERE');

client.on("ready", () => {

    console.log("->Logged in.")
    persistent.fetch();

    let gameGuild = client.guilds.cache.find(element => element.id === '738364448179355739');
    AnnounceChannel = gameGuild.channels.cache.find(element => element.id === '738397944155340902');

})

client.on("messageReactionAdd", async (reaction, user) => {

    if(user.bot)
        return;

    if(reaction.message.channel.name == AnnounceChannelName){

        let member = reaction.message.guild.members.cache.get(user.id);

        switch(reaction.emoji.name){

            case JoinEmoji:
                AddPlayer(member, "accepted", reaction); 
                LobbyMessage.edit(GenerateEmbed());
                break;
            case MaybeEmoji:
                AddPlayer(member, "maybe", reaction); 
                LobbyMessage.edit(GenerateEmbed());
                break;
            case RejectEmoji:
                AddPlayer(member, "rejected", reaction); 
                LobbyMessage.edit(GenerateEmbed());
                break;

            case AnnounceEmoji:
                member.roles.add(await getAnnounceRole(reaction.message.guild))
                    .catch(err => { console.log("Role couldnt be added to ") + user.username + ". Reason: " + err});
                    break;

            case "📣":
                break;

            default: 
                lobbyActive = false;
                ClearList();
                ToBeDeleted.forEach(message => message.delete())
                ToBeDeleted = []
                break;

        }

    }

});

client.on("messageReactionRemove", async (reaction, user) => {

    if(user.bot)
        return;

    if(reaction.message.channel.name == "announce"){

        let member = reaction.message.guild.members.cache.get(user.id);
        switch(reaction.emoji.name){

            case JoinEmoji:
                RemovePlayer(member, "accepted", reaction); 
                LobbyMessage.edit(GenerateEmbed());
                break;
            case MaybeEmoji:
                RemovePlayer(member, "maybe", reaction); 
                LobbyMessage.edit(GenerateEmbed());
                break;
            case RejectEmoji:
                RemovePlayer(member, "rejected", reaction); 
                LobbyMessage.edit(GenerateEmbed());
                break;

            case AnnounceEmoji:
                member.roles.remove(await getAnnounceRole(reaction.message.guild))
                    .catch(err => { console.log("Role couldnt be added to ") + user.username + ". Reason: " + err});
                break;

        }

    }

    else if(reaction.message.channel.name == ControlChannelName){

        switch(reaction.emoji.name){

            case MuteEmoji:
                let voiceChannel = VoiceChannels.filter(channel => channel.members.find(member => member.id == user.id))
                voiceChannel.forEach(channel => {
                    channel.updateOverwrite(channel.guild.roles.everyone, { SPEAK: false });
                    console.log("channel name: " + channel.name + " speak override: true");
                });
                break;

        }

    }

});

client.on('message', async message => {

    if(message.channel.type == "dm")
        return;

    let prefix = getServer(message.guild.id).prefix;

    if(message.content.startsWith(prefix + SECONDARY_PREFIX) && message.member.hasPermission("ADMINISTRATOR")){

        let command = message.content.slice((prefix + SECONDARY_PREFIX).length).toLowerCase();
        if(command.startsWith("announce ")){

            if(lobbyActive){
                message.channel.send("Theres an active lobby.");
                return;
            }

            let time = command.slice("announce ".length);
            lobbyTime = time;
            PostAnnouncement();

        }

        else if(command == "mention"){

            let string = "";
            for(const player of PlayerList["accepted"])
                string += "<@" + player.id + "> ";
            string += "zaman geldi."
            message.channel.send(string);

            if(PlayerList["accepted"].length >= 10)
                return;

            string = "";
            for(const player of PlayerList["maybe"])
                string += "<@" + player.id + "> ";
            string += (10 - PlayerList["accepted"].length) + " kişi daha lazım.";
            message.channel.send(string);

        }

    }

});

function getServer(guildID){

    for(let i = 0; i < persistent.list.length; i++)
        if(persistent.list[i].guildID == guildID)
            return persistent.list[i];

            let server = new Server(guildID);
    persistent.add(server);

    return server;

}

async function PostAnnouncement(){

    LobbyMessage = await AnnounceChannel.send(GenerateEmbed());
    ToBeDeleted.push(LobbyMessage);
    lobbyActive = true;

    LobbyMessage.react(JoinEmoji).then( () => { 
        LobbyMessage.react(MaybeEmoji).then( () => { 
            LobbyMessage.react(RejectEmoji) }) })

    let image = await FlamingText("Time: " + lobbyTime)

    let message = AnnounceChannel.send({files: [image]});
    ToBeDeleted.push(message);

    let announce = await getAnnounceRole(AnnounceChannel.guild)
    message = AnnounceChannel.send("<@&" + announce + "> come join this lobby!")
    ToBeDeleted.push(message);

}

function GenerateEmbed(){

    let acceptedPlayers = "";
    for(let player of PlayerList["accepted"])
        acceptedPlayers += player.displayName + '\n';

    let maybePlayers = "";
    for(let player of PlayerList["maybe"])
    maybePlayers += player.displayName + '\n';

    let rejectedPlayers = "";
    for(let player of PlayerList["rejected"])
    rejectedPlayers += player.displayName + '\n';

    let Embed = new Discord.MessageEmbed();
    Embed.setTitle("Among Us Lobby | Time: " + lobbyTime);

    Embed.addFields(
        {name: "Accepted: " + PlayerList["accepted"].length,    value: acceptedPlayers.length == 0  ? '\u200b' : acceptedPlayers,   inline: true},
        {name: "Maybe: "    + PlayerList["maybe"].length,       value: maybePlayers.length == 0     ? '\u200b' : maybePlayers,      inline: true}, 
        {name: "Rejected: " + PlayerList["rejected"].length,    value: rejectedPlayers.length == 0  ? '\u200b' : rejectedPlayers,   inline: true}
    )
    
    return Embed;

}

/** @param {Discord.Guild} guild */
async function getAnnounceRole(guild){

    //Find role or create one
    let role;
    role = guild.roles.cache.find(element => element.name === AnnounceRoleName);
    if(role === undefined){
		role = await guild.roles.create({
            data: {
                name: AnnounceRoleName,
                mentionable: true
            },
			reason: 'Role added for Among Us announcements.'
        });
        
    }

    return role;

}

/** @param {Discord.GuildMember} member */
function AddPlayer(member, subList, reaction){

    for(const sublist of ['accepted', 'maybe', 'rejected'])
        for(const player of PlayerList[sublist])
            if(player.id == member.id){
                reaction.users.remove(member.id);
                return;
            }

    PlayerList[subList].push(member);
    return true;

}

/** @param {Discord.GuildMember} member 
 *  @param {Discord.MessageReaction} reaction
*/
function RemovePlayer(member, subList, reaction){

    for(const i in PlayerList[subList])
        if(PlayerList[subList][i].id == member.id){
            PlayerList[subList].splice(i, 1);
            return;
        }

}

function ClearList(){

    PlayerList["accepted"] = [];
    PlayerList["maybe"] = [];
    PlayerList["rejected"] = [];

}