// src/commands/purge-users.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  category: 'Admin',
  data: new SlashCommandBuilder()
    .setName('purge-users')
    .setDescription('Manually runs the purge check for unverified members.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
    await interaction.reply({ content: `⏳ ${mode} Starting manual purge check...`, ephemeral: true });

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.followUp({ content: 'I need the "Kick Members" permission to run this command.', ephemeral: true });
    }

    try {
      const db = await readDb();
      const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
      const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
      const purgeDays = config.purgeDelayDays;
      const graceDays = config.purgeGracePeriodDays;
      const totalPurgeThreshold = purgeDays + graceDays;
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
      let purgedCount = 0;
      let skippedCount = 0;
      let candidatesFound = 0;
      const purgeList = [];

      for (const member of members.values()) {
        if (member.user.bot || !(member.roles.cache.has(unverifiedRole.id)) || (verifiedRole && member.roles.cache.has(verifiedRole.id))) {
          continue;
        }

        candidatesFound++;
        const joinDateStr = db.memberJoinDates[member.id]?.joined;
        if (!joinDateStr) continue;

        const daysDifference = (now - new Date(joinDateStr)) / (1000 * 3600 * 24);

        if (daysDifference > totalPurgeThreshold) {
          purgeList.push(`- ${member.user.tag} (${daysDifference.toFixed(1)} days)`);
          if (!config.enableDryRun) {
            try {
              await member.kick(`Manually purged for not completing verification within the deadline.`);
              purgedCount++;
              delete db.memberJoinDates[member.id];
            } catch (error) {
              console.error(`[PURGE-CMD] Failed to kick ${member.user.tag}:`, error);
              skippedCount++;
            }
          }
        }
      }

      if (!config.enableDryRun && purgedCount > 0) {
        await writeDb(db);
      }

      let finalReport = `✅ **${mode} Manual Purge Check Complete!**\n` +
        `- Checked **${candidatesFound}** member(s) with the "${unverifiedRole.name}" role.\n` +
        `- Identified **${purgeList.length}** member(s) past the **${totalPurgeThreshold}-day** threshold.`;

      if (purgeList.length > 0) {
        finalReport += `\n\n**Identified Users:**\n${purgeList.slice(0, 15).join('\n')}`;
        if (purgeList.length > 15) finalReport += `\n...and ${purgeList.length - 15} more.`;
      }

      if (!config.enableDryRun) {
        finalReport += `\n\n- Successfully kicked **${purgedCount}** member(s).`;
      }
      if (skippedCount > 0) {
        finalReport += `\n- Failed to kick **${skippedCount}** member(s).`;
      }

      await interaction.editReply({ content: finalReport });

    } catch (error) {
      console.error('Error during purge-users command:', error);
      await interaction.editReply({ content: 'An error occurred. Check the console.' });
    }
  },
};