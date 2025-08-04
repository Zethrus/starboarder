// src/commands/backfill-joins.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backfill-joins')
    .setDescription('One-time command to populate the database with join dates for existing members.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    try {
      await interaction.reply({ content: '⏳ Starting to backfill join dates for existing members...', ephemeral: true });

      const db = await readDb();
      if (!db.memberJoinDates) {
        db.memberJoinDates = {};
      }

      const members = await interaction.guild.members.fetch();
      let addedCount = 0;
      let existingCount = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        if (db.memberJoinDates[member.id]) {
          existingCount++;
        } else {
          db.memberJoinDates[member.id] = {
            joined: member.joinedAt.toISOString(),
            reminderSent: false
          };
          addedCount++;
        }
      }

      await writeDb(db);

      const finalReply = `✅ **Backfill Complete!**\n- Added **${addedCount}** new members.\n- Skipped **${existingCount}** existing members.`;
      // Use followUp since we already replied.
      await interaction.followUp({ content: finalReply, ephemeral: true });

    } catch (error) {
      console.error('Error during backfill-joins command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An error occurred while trying to backfill the member data. Please check the console for details.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An error occurred while trying to backfill the member data. Please check the console for details.', ephemeral: true });
      }
    }
  },
};