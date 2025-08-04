// src/commands/purge-users.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'purge-users',
  description: 'Manually runs the purge check for unverified members who are past their deadline.',
  async execute(message, args) {
    const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
    if (config.enableDryRun) {
      await message.reply(`Running manual purge check in **[DRY RUN]** mode. No actions will be taken.`);
    }

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You must be an Administrator to run this command.');
    }
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('I need the "Kick Members" permission to run this command.');
    }

    try {
      const initialReply = await message.channel.send(`⏳ ${mode} Starting manual purge check...`);

      const db = readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
      const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
      const purgeDays = config.purgeDelayDays;
      const graceDays = config.purgeGracePeriodDays;
      const totalPurgeThreshold = purgeDays + graceDays;
      const now = new Date();

      const guild = message.guild;
      const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
      const verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === verifiedRoleName);
      const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);

      if (!unverifiedRole) {
        return initialReply.edit(`Error: The role named "${config.unverifiedRoleName}" was not found.`);
      }
      if (!verifiedRole) {
        await message.channel.send(`⚠️ **Warning:** The verified role "${config.verifiedRoleName}" was not found. The command will run without this safety check.`);
      }

      const members = await guild.members.fetch();
      let purgedCount = 0;
      let skippedCount = 0;
      let candidatesFound = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        const isVerified = verifiedRole && member.roles.cache.has(verifiedRole.id);
        const isUnverified = member.roles.cache.has(unverifiedRole.id);

        if (isVerified || !isUnverified) {
          continue;
        }

        candidatesFound++;
        const joinDateStr = db.memberJoinDates[member.id]?.joined;
        if (!joinDateStr) continue;

        const joinDate = new Date(joinDateStr);
        const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

        if (daysDifference > totalPurgeThreshold) {
          const kickReason = `Manually purged for not completing verification within the deadline.`;
          const logMessage = `👢 **${mode} Purge**: ${member.user.tag} would be purged (unverified for ${daysDifference.toFixed(1)} days).`;

          if (config.enableDryRun) {
            purgedCount++;
            if (logChannel) await logChannel.send(logMessage);
          } else {
            try {
              await member.kick(kickReason);
              purgedCount++;
              if (logChannel) await logChannel.send(logMessage);
              delete db.memberJoinDates[member.id];
            } catch (error) {
              console.error(`[PURGE-CMD] Failed to kick ${member.user.tag}:`, error);
              skippedCount++;
            }
          }
        }
      }

      if (!config.enableDryRun) {
        writeDb(db);
      }

      const finalReport = `✅ **${mode} Manual Purge Check Complete!**\n` +
        `- Checked **${candidatesFound}** member(s) with the "${unverifiedRole.name}" role.\n` +
        `- Identified **${purgedCount}** member(s) past the **${totalPurgeThreshold}-day** purge threshold.\n` +
        `- Failed to kick **${skippedCount}** member(s) (see console for errors).`;

      await initialReply.edit(finalReport);

    } catch (error) {
      console.error('Error during purge-users command:', error);
      await message.channel.send('An error occurred while running the purge command. Please check the console for details.');
    }
  },
};