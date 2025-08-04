// src/commands/remind-users.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'remind-users',
  description: 'Manually runs the reminder check for unverified members who are past their deadline.',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You must be an Administrator to run this command.');
    }

    try {
      const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
      await message.reply(`⏳ Starting manual reminder check in **${mode}** mode. This may take a moment...`);

      const db = readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
      const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
      const reminderDays = config.verificationReminderDelayDays;
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

        if (daysDifference > reminderDays && !db.memberJoinDates[member.id]?.reminderSent) {
          const logMessage = `🔔 **Reminder Target**: ${member.user.tag} (${member.id}) has been unverified for ${daysDifference.toFixed(1)} days.`;

          if (config.enableDryRun) {
            actionCount++;
            console.log(`[DRY RUN] [REMIND-CMD] Would remind ${member.user.tag}.`);
            if (logChannel) await logChannel.send(`[DRY RUN] ${logMessage}`);
          } else {
            try {
              await member.send(config.verificationReminderMessage);
              actionCount++;
              if (logChannel) await logChannel.send(logMessage.replace('Target', 'Sent'));
              db.memberJoinDates[member.id].reminderSent = true;
              dbModified = true;
            } catch (error) {
              // ... (error handling)
            }
          }
        }
      }

      if (dbModified && !config.enableDryRun) {
        writeDb(db);
      }

      const finalVerb = config.enableDryRun ? 'identified for a reminder' : 'sent a reminder';
      await message.channel.send(`✅ **Manual Reminder Check Complete!**\n- **${actionCount}** member(s) ${finalVerb}.`);

    } catch (error) {
      console.error('Error during remind-users command:', error);
      await message.channel.send('An error occurred while running the reminder command. Please check the console for details.');
    }
  },
};