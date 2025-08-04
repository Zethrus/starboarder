// src/commands/purge-users.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'purge-users',
  description: 'Manually runs the purge check for unverified members who are past their deadline.',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You must be an Administrator to run this command.');
    }
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('I need the "Kick Members" permission to run this command.');
    }

    try {
      await message.reply('⏳ Starting manual purge of unverified members. This may take a moment...');

      const db = readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
      const purgeDays = config.purgeDelayDays;
      const now = new Date();

      const guild = message.guild;
      const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
      const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);

      if (!unverifiedRole) {
        return message.channel.send(`Error: The role named "${config.unverifiedRoleName}" was not found.`);
      }

      const members = await guild.members.fetch();
      let purgedCount = 0;

      for (const member of members.values()) {
        if (member.user.bot || !member.roles.cache.has(unverifiedRole.id)) {
          continue;
        }

        const joinDateStr = db.memberJoinDates[member.id];
        if (!joinDateStr) continue;

        const joinDate = new Date(joinDateStr);
        const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

        if (daysDifference > purgeDays) {
          try {
            const kickReason = `Manually purged for not completing verification within ${purgeDays} days.`;
            await member.kick(kickReason);
            purgedCount++;
            const logMessage = `👢 **Manually Purged User**: ${member.user.tag} (${member.id})\n**Reason**: ${kickReason}`;
            console.log(`[PURGE-CMD] ${logMessage.replace(/\n/g, ' ')}`);
            if (logChannel) await logChannel.send(logMessage);

            delete db.memberJoinDates[member.id];
          } catch (error) {
            console.error(`[PURGE-CMD] Failed to kick ${member.user.tag}:`, error);
            await message.channel.send(`Failed to kick ${member.user.tag}. See console for details.`);
          }
        }
      }

      writeDb(db);

      await message.channel.send(`✅ **Manual Purge Complete!**\n- Kicked **${purgedCount}** unverified member(s) who were past the ${purgeDays}-day deadline.`);

    } catch (error) {
      console.error('Error during purge-users command:', error);
      await message.channel.send('An error occurred while running the purge command. Please check the console for details.');
    }
  },
};