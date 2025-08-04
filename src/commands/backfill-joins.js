// src/commands/backfill-joins.js
const { PermissionFlagsBits } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: 'backfill-joins',
  description: 'One-time command to populate the database with join dates for all existing members.',
  async execute(message, args) {
    // 1. CHECK PERMISSIONS
    // Only allow administrators to run this command
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You must be an Administrator to run this command.');
    }

    try {
      await message.reply('⏳ Starting to backfill join dates for existing members. This may take a moment...');

      // 2. READ DATABASE
      const db = readDb();
      if (!db.memberJoinDates) {
        db.memberJoinDates = {};
      }

      // 3. FETCH ALL MEMBERS
      // We fetch all members to ensure we have a complete list, not just a partial cache.
      const members = await message.guild.members.fetch();
      let addedCount = 0;
      let existingCount = 0;

      console.log(`[BACKFILL] Found ${members.size} members in the server.`);

      // 4. ITERATE AND UPDATE
      for (const member of members.values()) {
        // Skip bots
        if (member.user.bot) {
          continue;
        }

        // Check if the member is already in our database
        if (db.memberJoinDates[member.id]) {
          existingCount++;
        } else {
          // If not, add them using their original join timestamp
          db.memberJoinDates[member.id] = member.joinedAt.toISOString();
          addedCount++;
        }
      }

      // 5. WRITE TO DATABASE
      writeDb(db);

      // 6. SEND CONFIRMATION
      const finalReply = `✅ **Backfill Complete!**\n- Added **${addedCount}** new members to the tracking database.\n- Skipped **${existingCount}** members who were already being tracked.`;
      await message.channel.send(finalReply);
      console.log(`[BACKFILL] ${finalReply.replace(/\n/g, ' ')}`);

    } catch (error) {
      console.error('Error during backfill-joins command:', error);
      await message.channel.send('An error occurred while trying to backfill the member data. Please check the console for details.');
    }
  },
};