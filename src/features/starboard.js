// src/features/starboard.js
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getImageFromMessage, formatEmoji, readDb, writeDb } = require('../utils/helpers');

async function handleStarboard(reaction, user) {
  // Check if reaction matches our configured emoji
  const emoji = config.starEmoji;
  const isMatch = emoji.isCustom
    ? reaction.emoji.id === emoji.id
    : reaction.emoji.name === emoji.name;

  if (!isMatch) return;

  // Fetch the full message if it's a partial
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      console.error('Error fetching partial message for starboard:', error);
      return;
    }
  }
  const message = reaction.message;

  // Fetch the current star count for this emoji.
  // We need to fetch the reaction from the message again to get an accurate count.
  const starReaction = message.reactions.cache.get(emoji.isCustom ? emoji.id : emoji.name);
  const starCount = starReaction ? starReaction.count : 0;

  // Find starboard and log channels
  const starboardChannel = message.guild.channels.cache.find(
    channel => channel.name === config.starboardChannel && channel.isTextBased()
  );
  if (!starboardChannel) {
    console.error(`Starboard channel #${config.starboardChannel} not found in server: ${message.guild.name}`);
    return;
  }
  const logChannel = message.guild.channels.cache.find(channel => channel.name === config.logChannelName);

  const db = readDb();
  const starboardPostId = db.starboardPosts[message.id];

  // --- SCENARIO 1: Message is NOT on the starboard ---
  if (!starboardPostId) {
    // If it doesn't meet the star requirement, do nothing.
    if (starCount < config.requiredStars) return;

    // If it has no image, do nothing.
    const image = getImageFromMessage(message);
    if (!image) return;

    // Create the embed and post it.
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setDescription(message.content || '_No content provided_')
      .setImage(image)
      .addFields(
        { name: 'Original Message', value: `[Jump to message](${message.url})` },
        { name: 'Stars', value: `${starCount} ${formatEmoji(emoji)}`, inline: true },
        { name: 'Channel', value: `${message.channel}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Message ID: ${message.id}` });

    try {
      const starboardMessage = await starboardChannel.send({ embeds: [embed] });
      // Save the new post's ID to the database
      db.starboardPosts[message.id] = starboardMessage.id;
      writeDb(db);

      const logMessage = `⭐ **New Starboard Post**: Message by ${message.author.tag} in ${message.channel} reached ${starCount} stars.`;
      if (logChannel) await logChannel.send(logMessage);
    } catch (error) {
      console.error(`Error creating starboard post for message ${message.id}:`, error);
    }
    return;
  }

  // --- SCENARIO 2: Message IS on the starboard ---
  if (starboardPostId) {
    try {
      const starboardMessage = await starboardChannel.messages.fetch(starboardPostId);

      // SCENARIO 2a: Star count fell below threshold, so delete the post.
      if (starCount < config.requiredStars) {
        await starboardMessage.delete();
        delete db.starboardPosts[message.id];
        writeDb(db);

        const logMessage = `❌ **Starboard Post Removed**: Message by ${message.author.tag} in ${message.channel} fell below ${config.requiredStars} stars.`;
        if (logChannel) await logChannel.send(logMessage);
      }
      // SCENARIO 2b: Star count is still sufficient, so update the count.
      else {
        // Get the original embed and update it.
        const oldEmbed = starboardMessage.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed).setFields(
          oldEmbed.fields.map(field => {
            if (field.name === 'Stars') {
              return { ...field, value: `${starCount} ${formatEmoji(emoji)}` };
            }
            return field;
          })
        );

        await starboardMessage.edit({ embeds: [newEmbed] });
      }
    } catch (error) {
      console.error(`Error updating/deleting starboard post ${starboardPostId}:`, error);
      // If the message was deleted from the starboard, remove it from our DB.
      if (error.code === 10008) { // Unknown Message
        delete db.starboardPosts[message.id];
        writeDb(db);
      }
    }
  }
}

module.exports = handleStarboard;