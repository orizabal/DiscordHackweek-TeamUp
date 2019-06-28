const Discord = require('discord.js');
const auth = require('../auth.json');
const config = require('../config.json');
const colors = require('../colors.json');
const func = require('../functions.js');
const mongoose = require('mongoose');
const Models = require('../models.js');

//Main loop for executing command
module.exports.run = async (client, message, args) => {
  //group create [name] [game] [date] [time] [max players]
  //args[0] args[1] args[2] args[3] args[4] args[5] args[6]
  var server = message.guild.id;
  var regex = /"[^"]+"|[^\s]+/g;
  args = message.content.match(regex).map(e => e.replace(/"(.+)"/, "$1"));

  if (args[1] === "create") {

    var dateTime = func.readUserDate(args[4], args[5]);

    //catch errors

    if (args[2] == null) {
      message.channel.send("Please specify the name of this group.");
      return;
    }
    if (args[3] == null) {
      message.channel.send("Please specify the game this group will play.");
      return;
    }
    if (dateTime === false) {
      message.channel.send("Please specify the date and time of your group's meeting time in YYYY-MM-DD HH:MM format.");
      return;
    }
    if (args[6] == null) {
      message.channel.send("Please specify the maximum number of players for this group.");
      return;
    } else if (isNaN(args[6])) {
      message.channel.send("Please specify the maximum number of players for this group.");
      return;
    }

    var group = new Models.Group({
      creator: message.author,
      name: args[2],
      game: args[3],
      date: dateTime,
      participants: [message.author],
      maxPlayers: args[6],
      server: server
    });

    //verify a group with the submitted name isn't already in db
    Models.Group.findOne({ name: args[2] }, function (error, result) {
      if (result != null) {
        message.channel.send("A group with this name already exists! Join them with `?group join " + args[2] + "` or choose a different name.");
      } else {
        //save the group into mongodb
        group.save(function (error) {
          if (error) {
            console.error(error);
          } else {
            console.log("Group successfully saved into mongodb.");
            message.channel.send("Group created!");
          }
        });
      }
    });
  } else if (args[1] === "join") { //group join [name]
    //find group with name == args[1] in this server/message channel
    //add message.author to participants list
    // COMBAK: We need to prevent players from joining if they are already in the group
    Models.Group.findOne({ name: args[2], server: server }, function (err, docs) {
      if (err) {
        console.error(err)
        return;
      }
      if (docs == null) {
        message.channel.send("That group doesn't exist.");
        return;
      }
      if (docs.participants.includes(message.author)) {
        message.channel.send("You are already in that group!");
        return;
      }
      if (docs.participants.length >= docs.maxPlayers){
        message.channel.send("This group is at maximum capacity.");
        return;
      }

      docs.participants.push(message.author);
      docs.save(function (error) {
        if (error) {
          console.error(error);
          return;
        } else {
          console.log("Group successfully saved into mongodb.");
          message.channel.send('You joined the group.');
        }
      });
    });


  } else if (args[1] === "leave") { //group leave [name]
    //find group with name == args[1] in this server/message channel
    //remove message.author from participants list
    Models.Group.findOne({ name: args[2], server: server }, function (err, docs) {
      if (err) {
        console.error(err)
        return;
      }
      if (docs == null) {
        message.channel.send("That group doesn't exist.");
        return;
      }

      if (docs.creator == message.author) {
        message.channel.send("You cannot leave a group you created. You can remove the group using `?group disband " + args[2] +"`.");
        return;
      }

      var index = docs.participants.indexOf(message.author)
      if (index > -1) {
        docs.participants.splice(index, 1);
        docs.save(function (error) {
          if (error) {
            console.error(error);
            message.channel.send("**ERROR:** " + error.message);
            return;
          } else {
            console.log("Group successfully saved into mongodb.");
            message.channel.send('You left the group.');
          }
        });
      } else {
        message.channel.send("You are not in that group!");
      }

    });
  } else if (args[1] === "disband" || args[1] === "delete") { //group disband [name]
    //find group with name == args[1] in this server/message channel
    //confirm message.author is group creator
    //delete group

    Models.Group.findOneAndDelete({ name: args[2], creator: message.author, server: server }, function (err, docs) {
      if (err) {
        console.error(err)
        return;
      }
      if (docs == null) {
        message.channel.send("You cannot delete that group.");
        return;
      }
      message.channel.send("Group deleted");
    });



  } else if (args[1] === "info") { //group info [name]
    //find group with name == args[1] in this server/message channel
    //send message about the info of the group
    //name of group, time and date, game, participants, owner
    Models.Group.findOne({ server: server, name: args[2] }, function (error, result) {
      //console.log(result);
      var creatorID = result.creator.substring(2, result.creator.length - 1);
      var creatorUsername = message.guild.members.get(creatorID).user.username;
      var creatorAvatarURL = message.guild.members.get(creatorID).user.displayAvatarURL;

      var participants = result.participants;
      var participantsAmount = result.participants.length;
      var maxParticipants = result.maxPlayers;
      var game = result.game;
      var date = result.date;

      var groupInfoEmbed = new Discord.RichEmbed()
        .setColor(colors.orange)
        .setTitle(result.name)
        .setAuthor(creatorUsername + "'s " + game + " group", creatorAvatarURL)
        .setDescription(creatorUsername + " created this group with " + participantsAmount + " participants for " + game + ".")
        .setThumbnail(creatorAvatarURL)
        .addField("Creator", creatorUsername, true)
        .addField("Game", game, true)
        .addField("Date", date, true)
        .addField("Participants", participants, true)
        .addField("Maximum Participants", maxParticipants, true);

      message.channel.send(groupInfoEmbed);
    });
  } else if (args[1] === "list") { //group list
    var pages = [];
    var page = 1;

    //lists all the available groups in the server

    var result = await Models.Group.find({ server: server });

    for (var i = 0; i < result.length; i++) {
      var creatorID = result[i].creator.substring(2, result[i].creator.length - 1);
      var creatorUsername = message.guild.members.get(creatorID).user.username;
      var creatorAvatarURL = message.guild.members.get(creatorID).user.displayAvatarURL;

      var participants = result[i].participants;
      var participantsAmount = result[i].participants.length;
      var maxParticipants = result[i].maxPlayers;
      var game = result[i].game;
      var date = result[i].date;

      var embed = new Discord.RichEmbed()
        .setColor(colors.orange)
        .setTitle(result[i].name)
        .setAuthor(creatorUsername + "'s " + game + " group", creatorAvatarURL)
        .setDescription(creatorUsername + " created this group with " + participantsAmount + " participants for " + game + ".")
        .setThumbnail(creatorAvatarURL)
        .addField("Creator", creatorUsername, true)
        .addField("Game", game, true)
        .addField("Date", date, true)
        .addField("Participants", participants, true)
        .addField("Maximum Participants", maxParticipants, true)
        .setFooter(`Page ${i+1} of ${result.length}`);

      pages.push(embed);
    }

    message.channel.send(pages[0]).then(msg => {
      msg.react('◀').then(r => {
        msg.react('▶');

        //Filter ensure variables are correct before running code
        const backwardsFilter = (reaction, user) => reaction.emoji.name === '◀' && user.id === message.author.id;
        const forwardsFilter = (reaction, user) => reaction.emoji.name === '▶' && user.id === message.author.id;

        //User will be able to react within 60seconds of requesting this embed
        const backwards = msg.createReactionCollector(backwardsFilter, { time: 60000 });
        const forwards = msg.createReactionCollector(forwardsFilter, { time: 60000 });

        backwards.on('collect', r => {
          if (page === 1) { msg.reactions.get('◀').remove(message.author.id); return; }
          page--;
          msg.edit(pages[page - 1]);
          msg.reactions.get('◀').remove(message.author.id);
        });

        backwards.on('stop', async () => {
          await message.clearReactions();
        });

        forwards.on('collect', r => {
          if (page === pages.length) { msg.reactions.get('▶').remove(message.author.id); return; }
          page++;
          msg.edit(pages[page - 1]);
          msg.reactions.get('▶').remove(message.author.id);
        });

        forwards.on('stop', async () => {
          await message.clearReactions();
        });
      });
    });
  } else {
    message.channel.send("I don't understand your request. Type `?help group` for a list of commands I can understand.");
  }
}

//Config for the command here
module.exports.config = {
  name: 'group',
  aliases: ['team', "teamup", "squad", "g"],
  description: 'Used to create or manage a group.',
  usage: 'group create [name] [game] [date] [time] [max players]\n group join [name]\n group leave [name]\n group disband [name]\n group info [name]\n group list\n\n **[name]** and **[game]** must be placed inside double quotation marks \n **[date]** needs to be in YYYY-MM-DD format\n **[time]** should be in HH:MM format',//Time Doesn't need to be in 24h format.
  example: '?group create "Friday Game Night" "Super Smash Bros" 2019-06-28 20:00 10',
  noalias: "No Aliases"
}
