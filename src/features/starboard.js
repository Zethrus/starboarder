// src/features/starboard.js
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getImageFromMessage, formatEmoji, readDb, writeDb } = require('../utils/helpers'); // <-- ADD readDb and writeDb

// Store starred message IDs to prevent duplicates during this session
// const starredMessages = new Set(); // <-- REMOVE THIS

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

  // --- DATABASE CHECK ---
  const db = readDb();
  if (db.starredMessageIds[message.id]) {
    return; // Already starred, so we stop here.
  }
  // ----------------------


  // Get star count
  const starCount = reaction.count;

  // Check if message has enough stars
  if (starCount < config.requiredStars) return;

  // Check if message has an image
  const image = getImageFromMessage(message);
  if (!image) return;

  // Find starboard and log channels
  const starboardChannel = message.guild.channels.cache.find(
    channel => channel.name === config.starboardChannel && channel.isTextBased()
  );
  const logChannel = message.guild.channels.cache.find(channel => channel.name === config.logChannelName);

  if (!starboardChannel) {
    console.error(`Starboard channel #${config.starboardChannel} not found in server: ${message.guild.name}`);
    return;
  }

  // Create starboard embed
  const embed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold color
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
      url: `https://discord.com/users/${message.author.id}`
    })
    .setDescription(message.content || '_No content provided_')
    .setImage(image)
    .addFields(
      { name: 'Original Message', value: `[Jump to message](${message.url})` },
      { name: 'Stars', value: `${starCount} ${formatEmoji(emoji)}`, inline: true },
      { name: 'Channel', value: `${message.channel}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Message ID: ${message.id} | Author ID: ${message.author.id}` });

  // Post to starboard
  try {
    await starboardChannel.send({ embeds: [embed] });

    // --- DATABASE UPDATE ---
    db.starredMessageIds[message.id] = true; // Mark as starred
    writeDb(db); // Save to database
    // -----------------------

    const logMessage = `⭐ **New Starboard Post**: Message by ${message.author.tag} in ${message.channel} reached the threshold with ${starCount} stars.`;
    console.log(`Message ${message.id} posted to starboard in server: ${message.guild.name}`);
    if (logChannel) await logChannel.send(logMessage);
  } catch (error) {
    console.error(`Error posting to starboard in server ${message.guild.name}:`, error);
  }
}

module.exports = handleStarboard;