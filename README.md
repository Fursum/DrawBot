This repo contains 2 clients which share a persistent file

# Draw.js
This is a drawing game creator. It automatically handles creation and removal of channels.


### Gameplay
The game is similar to https://garticphone.com/

When a lobby is created, bot creates a public channel. From this channel players can join, change settings and start the game.

After the game is started, private player channels are created. From those channels, players can submit their prompts and drawings then confirm them to sumbit.


### Usage
There is a built in context sensitive help command:
```
PREFIX help
```

# Lobby.js
This was created to manage Among Us lobbies.

An event is created with a specified time. The optional role gets pinged. People can accept, reject or put a maybe on the event embed. 

Their Discord names and their selection will be visible.


### Usage
The default prefixes aren't very practical. If this is the only functionality of the bot, you are welcome to change it. You can simply leave the ```SECONDARY_PREFIX``` string empty.

Currently, bot only supports one event simultaneously.

❗**You need to change the server and announce channel id on line 50-51, to your server/channel's.**


#### Creating the event
```
PREFIX SECONDARY_PREFIX create announce [time]

example:
!create announce 21:30
```
This will create an embed with the planned time for it's title, then send an announcement role mention.

#### Mention the accepted players
```
PREFIX SECONDARY_PREFIX mention
```
This will mention the accepted and tertiary players.

#### Removing the announcement
Simply react with another emoji to reset the bot.
