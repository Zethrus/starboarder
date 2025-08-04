// src/commands/backfill-joins.js
const { PermissionFlagsBits } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'backfill-joins',
  description: 'One-time command to populate the database with join dates for existing members.',
  async execute(message, args) {
    // ... (permission checks)

    try {
      await message.reply('⏳ Starting to backfill join dates for existing members...');

      const db = await readDb();
      if (!db.memberJoinDates) {
        db.memberJoinDates = {};
      }

      const members = await message.guild.members.fetch();
      let addedCount = 0;
      let existingCount = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        if (db.memberJoinDates[member.id]) {
          existingCount++;
        } else {
          // Store data in the new object format
          db.memberJoinDates[member.id] = {
            joined: member.joinedAt.toISOString(),
            reminderSent: false
          };
          addedCount++;
        }
      }

      await writeDb(db);

      const finalReply = `✅ **Backfill Complete!**\n- Added **${addedCount}** new members.\n- Skipped **${existingCount}** existing members.`;
      await message.channel.send(finalReply);

    } catch (error) {
      console.error('Error during backfill-joins command:', error);
      await message.channel.send('An error occurred while trying to backfill the member data. Please check the console for details.');
    }
  },
};