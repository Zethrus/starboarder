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

    // In live mode, the bot must have kick permissions. This check is skipped in dry run.
    if (!config.enableDryRun && !message.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('I need the "Kick Members" permission to run this command in live mode.');
    }

    try {
      const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
      await message.reply(`⏳ Starting manual purge of unverified members in **${mode}** mode. This may take a moment...`);

      const db = readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
      const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
      const purgeDays = config.purgeDelayDays;
      const now = new Date();

      const guild = message.guild;
      const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
      const verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === verifiedRoleName);
      const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);

      if (!unverifiedRole) {
        return message.channel.send(`Error: The role named "${config.unverifiedRoleName}" was not found.`);
      }
      if (!verifiedRole) {
        await message.channel.send(`⚠️ **Warning:** The verified role "${config.verifiedRoleName}" was not found. The command will run without this safety check.`);
      }

      const members = await guild.members.fetch();
      let actionCount = 0;
      let skippedCount = 0;
      let dbModified = false;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        const isVerified = verifiedRole && member.roles.cache.has(verifiedRole.id);
        const isUnverified = member.roles.cache.has(unverifiedRole.id);

        if (isVerified || !isUnverified) continue;

        const joinDateStr = db.memberJoinDates[member.id]?.joined;
        if (!joinDateStr) continue;

        const joinDate = new Date(joinDateStr);
        const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

        if (daysDifference > purgeDays) {
          const logMessage = `👢 **Purge Target**: ${member.user.tag} (${member.id}) has been unverified for ${daysDifference.toFixed(1)} days.`;

          if (config.enableDryRun) {
            actionCount++;
            console.log(`[DRY RUN] [PURGE-CMD] Would purge ${member.user.tag}.`);
            if (logChannel) await logChannel.send(`[DRY RUN] ${logMessage}`);
          } else {
            try {
              const kickReason = `Manually purged for not completing verification within ${purgeDays} days.`;
              await member.kick(kickReason);
              actionCount++;
              if (logChannel) await logChannel.send(logMessage.replace('Target', 'User'));
              delete db.memberJoinDates[member.id];
              dbModified = true;
            } catch (error) {
              console.error(`[PURGE-CMD] Failed to kick ${member.user.tag}:`, error);
              skippedCount++;
            }
          }
        }
      }

      if (dbModified && !config.enableDryRun) {
        writeDb(db);
      }

      const finalVerb = config.enableDryRun ? 'identified' : 'kicked';
      await message.channel.send(`✅ **Manual Purge Complete!**\n- **${actionCount}** member(s) ${finalVerb}.\n- Failed to kick **${skippedCount}** member(s) (see console for errors).`);

    } catch (error) {
      console.error('Error during purge-users command:', error);
      await message.channel.send('An error occurred while running the purge command. Please check the console for details.');
    }
  },
};