// src/features/themeSubmit.js
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getImageFromMessage, replyThenDelete } = require('../utils/helpers');

// Store theme submission IDs to prevent duplicates during this session
const themeSubmissions = new Set();

async function handleThemeSubmission(message) {
  const hashtag = config.themeHashtag;

  // Check if message contains the theme hashtag
  const hashtagRegex = new RegExp(`\\b${hashtag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const hasHashtag = hashtagRegex.test(message.content) ||
    message.embeds.some(e => e.description && hashtagRegex.test(e.description)) ||
    message.mentions.channels.some(c => `#${c.name}` === hashtag);

  if (!hasHashtag) return;

  // Skip if already submitted in this session
  if (themeSubmissions.has(message.id)) return;

  // Get the image URL, ensuring there is exactly one
  const image = getImageFromMessage(message, true); // The 'true' enforces a single image

  if (!image) {
    return replyThenDelete(message, `Your submission for ${hashtag} must include exactly one image. Please try again.`);
  }

  // Find theme and log channels
  const themeChannel = message.guild.channels.cache.find(
    channel => channel.name === config.themeChannel && channel.isTextBased()
  );
  const logChannel = message.guild.channels.cache.find(channel => channel.name === config.logChannelName); // <-- ADD THIS

  if (!themeChannel) {
    console.error(`Theme channel #${config.themeChannel} not found in server: ${message.guild.name}`);
    return;
  }

  // Get message content for description, removing the hashtag
  let description = message.content.replace(hashtagRegex, '').trim();

  // Create theme submission embed
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6) // Purple color
    .setTitle(`${hashtag} Submission`)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
      url: `https://discord.com/users/${message.author.id}`
    })
    .setDescription(description || 'No description provided')
    .setImage(image)
    .addFields(
      { name: 'Original Message', value: `[Jump to message](${message.url})` },
      { name: 'Submitted By', value: `${message.author}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Message ID: ${message.id} | Author ID: ${message.author.id}` });

  // Post to theme channel
  try {
    const sentMessage = await themeChannel.send({ embeds: [embed] }); // <-- MODIFY THIS
    themeSubmissions.add(message.id);
    const logMessage = `🎨 **New Theme Submission**: ${message.author.tag} submitted an entry for ${hashtag}. [Jump to submission](${sentMessage.url})`;
    console.log(`Message ${message.id} submitted to theme channel in server: ${message.guild.name}`);
    if (logChannel) await logChannel.send(logMessage); // <-- ADD THIS
    await replyThenDelete(message, `Your submission for ${hashtag} has been posted in #${config.themeChannel}!`);
  } catch (error) {
    console.error(`Error posting to theme channel in server ${message.guild.name}:`, error);
    await replyThenDelete(message, `There was an error submitting your post to #${config.themeChannel}. Please try again later.`);
  }
}

module.exports = handleThemeSubmission;