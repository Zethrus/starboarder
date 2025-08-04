// src/commands/remind-users.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind-users')
    .setDescription('Manually runs the reminder check for unverified members.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
    await interaction.reply({ content: `⏳ Starting manual reminder check in **${mode}** mode...`, ephemeral: true });

    try {
      const db = await readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
      const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
      const reminderDays = config.verificationReminderDelayDays;
      const now = new Date();

      const guild = interaction.guild;
      const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
      const verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === verifiedRoleName);
      const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);

      if (!unverifiedRole) {
        return interaction.editReply({ content: `Error: The role named "${config.unverifiedRoleName}" was not found.` });
      }
      if (!verifiedRole) {
        await interaction.channel.send(`⚠️ **Warning:** The verified role "${config.verifiedRoleName}" was not found. The command will run without this safety check.`);
      }

      const members = await guild.members.fetch();
      let actionCount = 0;
      let dbModified = false;

      for (const member of members.values()) {
        if (member.user.bot || !member.roles.cache.has(unverifiedRole.id) || (verifiedRole && member.roles.cache.has(verifiedRole.id))) continue;

        const joinDateStr = db.memberJoinDates[member.id]?.joined;
        if (!joinDateStr || db.memberJoinDates[member.id]?.reminderSent) continue;

        const daysDifference = (now - new Date(joinDateStr)) / (1000 * 3600 * 24);

        if (daysDifference > reminderDays) {
          const logMessage = `🔔 **Reminder Target**: ${member.user.tag} (${member.id}) has been unverified for ${daysDifference.toFixed(1)} days.`;
          actionCount++;

          if (config.enableDryRun) {
            if (logChannel) await logChannel.send(`[DRY RUN] ${logMessage}`);
          } else {
            try {
              await member.send(config.verificationReminderMessage);
              if (logChannel) await logChannel.send(logMessage.replace('Target', 'Sent'));
              db.memberJoinDates[member.id].reminderSent = true;
              dbModified = true;
            } catch (error) {
              if (logChannel) await logChannel.send(`❌ Failed to send reminder to ${member.user.tag}. They may have DMs disabled.`);
            }
          }
        }
      }

      if (dbModified && !config.enableDryRun) {
        await writeDb(db);
      }

      const finalVerb = config.enableDryRun ? 'identified for a reminder' : 'sent a reminder';
      await interaction.editReply({ content: `✅ **Manual Reminder Check Complete!**\n- **${actionCount}** member(s) ${finalVerb}.` });

    } catch (error) {
      console.error('Error during remind-users command:', error);
      await interaction.editReply({ content: 'An error occurred. Please check the console.' });
    }
  },
};