// src/commands/purge-users.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'purge-users',
  description: 'Manually runs the purge check for unverified members who are past their deadline.',
  async execute(message, args) {
    // --- Dry Run Check ---
    if (config.enableDryRun) {
      return message.reply('This command is disabled while `enableDryRun` is active in the configuration. Please disable it to run manual commands.');
    }

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
      const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim(); // <-- Get verified role name
      const purgeDays = config.purgeDelayDays;
      const now = new Date();

      const guild = message.guild;
      const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
      const verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === verifiedRoleName); // <-- Find verified role object
      const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);

      if (!unverifiedRole) {
        return message.channel.send(`Error: The role named "${config.unverifiedRoleName}" was not found.`);
      }
      if (!verifiedRole) {
        await message.channel.send(`⚠️ **Warning:** The verified role "${config.verifiedRoleName}" was not found. The command will run without this safety check.`);
      }

      const members = await guild.members.fetch();
      let purgedCount = 0;
      let skippedCount = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        // --- Enhanced Safety Check ---
        const isVerified = verifiedRole && member.roles.cache.has(verifiedRole.id);
        const isUnverified = member.roles.cache.has(unverifiedRole.id);

        // Skip this member if they are already verified OR they don't have the unverified role
        if (isVerified || !isUnverified) {
          continue;
        }

        // If we are here, the user is a valid purge candidate. Check their join date.
        const joinDateStr = db.memberJoinDates[member.id]?.joined;
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
            skippedCount++;
          }
        }
      }

      writeDb(db);

      await message.channel.send(`✅ **Manual Purge Complete!**\n- Kicked **${purgedCount}** unverified member(s).\n- Failed to kick **${skippedCount}** member(s) (see console for errors).`);

    } catch (error) {
      console.error('Error during purge-users command:', error);
      await message.channel.send('An error occurred while running the purge command. Please check the console for details.');
    }
  },
};