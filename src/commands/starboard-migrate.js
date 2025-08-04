// src/commands/starboard-migrate.js
const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb, replyThenDelete } = require('../utils/helpers');

module.exports = {
  name: 'starboard-migrate',
  description: 'One-time command to populate the database with existing starboard posts.',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return replyThenDelete(message, 'You must be an Administrator to run this command.');
    }

    const starboardChannel = message.guild.channels.cache.find(
      channel => channel.name === config.starboardChannel
    );
    if (!starboardChannel) {
      return message.reply(`Error: The starboard channel #${config.starboardChannel} was not found.`);
    }

    try {
      await message.reply('⏳ **Starting Starboard Migration...**\nFetching existing posts from the starboard channel. This may take a moment...');

      const db = readDb();
      // Ensure the structure is what we expect
      if (db.starboardPosts === undefined) {
        db.starboardPosts = {};
      }

      let fetchedMessages;
      let lastId;
      let migratedCount = 0;
      let duplicateCount = 0;

      // Loop to fetch all messages, as fetch is limited to 100 at a time
      while (true) {
        const options = { limit: 100 };
        if (lastId) {
          options.before = lastId;
        }

        fetchedMessages = await starboardChannel.messages.fetch(options);

        if (fetchedMessages.size === 0) {
          break; // No more messages to fetch
        }

        lastId = fetchedMessages.last().id;

        for (const starboardPost of fetchedMessages.values()) {
          // We only care about messages from the bot that have embeds
          if (!starboardPost.author.bot || starboardPost.embeds.length === 0) continue;

          const embed = starboardPost.embeds[0];
          if (!embed.footer || !embed.footer.text) continue;

          // Extract the original message ID from the footer
          const match = embed.footer.text.match(/Message ID: (\d+)/);
          if (!match || !match[1]) continue;

          const originalMessageId = match[1];

          // If it's not already in the DB, add it
          if (!db.starboardPosts[originalMessageId]) {
            db.starboardPosts[originalMessageId] = starboardPost.id;
            migratedCount++;
          } else {
            duplicateCount++;
          }
        }
      }

      writeDb(db);

      const finalReply = `✅ **Migration Complete!**\n- Migrated **${migratedCount}** new starboard posts to the database.\n- Found and skipped **${duplicateCount}** posts that were already logged.`;
      await message.channel.send(finalReply);

    } catch (error) {
      console.error('Error during starboard-migrate command:', error);
      await message.channel.send('An error occurred while trying to migrate the starboard posts. Please check the console for details.');
    }
  },
};