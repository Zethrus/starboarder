// src/commands/remind-users.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'remind-users',
  description: 'Manually runs the reminder check for unverified members who are past their deadline.',
  async execute(message, args) {
    // --- Dry Run Check ---
    if (config.enableDryRun) {
      return message.reply('This command is disabled while `enableDryRun` is active in the configuration. Please disable it to run manual commands.');
    }

    try {
      await message.reply('⏳ Starting manual reminder check for unverified members. This may take a moment...');

      const db = readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim(); //
      const reminderDays = config.verificationReminderDelayDays; //
      const now = new Date();

      const guild = message.guild;
      const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
      const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName); //

      if (!unverifiedRole) {
        return message.channel.send(`Error: The role named "${config.unverifiedRoleName}" was not found.`);
      }

      const members = await guild.members.fetch();
      let remindedCount = 0;

      for (const member of members.values()) {
        // Skip bots and members who don't have the unverified role
        if (member.user.bot || !member.roles.cache.has(unverifiedRole.id)) {
          continue;
        }

        // Skip if we don't have their join date for some reason
        const joinDateStr = db.memberJoinDates[member.id];
        if (!joinDateStr) continue;

        const joinDate = new Date(joinDateStr);
        const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

        // Check if the member has been in the server longer than the reminder threshold
        if (daysDifference > reminderDays) {
          try {
            await member.send(config.verificationReminderMessage); //
            remindedCount++;
            const logMessage = `🔔 **Manually Sent Reminder**: DM'd ${member.user.tag} (${member.id}) to complete verification.`;
            console.log(`[REMIND-CMD] ${logMessage}`);
            if (logChannel) await logChannel.send(logMessage);

            // To prevent spamming the user, remove them from the check by deleting their entry.
            // This mirrors the behavior of the automated task.
            delete db.memberJoinDates[member.id];

          } catch (error) {
            if (error.code === 50007) { // DiscordAPIError: Cannot send messages to this user
              console.warn(`[REMIND-CMD] Could not send DM to ${member.user.tag}. They may have DMs disabled.`);
            } else {
              console.error(`[REMIND-CMD] Failed to send DM to ${member.user.tag}:`, error);
            }
          }
        }
      }

      // Write the changes (deleted entries) back to the DB
      writeDb(db); //

      await message.channel.send(`✅ **Manual Reminder Check Complete!**\n- Sent DMs to **${remindedCount}** unverified member(s) who were past the ${reminderDays}-day deadline.`);

    } catch (error) {
      console.error('Error during remind-users command:', error);
      await message.channel.send('An error occurred while running the reminder command. Please check the console for details.');
    }
  },
};