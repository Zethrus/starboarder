// src/commands/help.js
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'help',
  description: 'Displays a list of all available commands and features.',
  async execute(message, args) {

    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF) // Light blue color
      .setTitle('UrbexWarden Help & Feature Guide')
      .setDescription('Here is a list of commands you can use and features to know about.')
      .setThumbnail(message.client.user.displayAvatarURL()) // Shows the bot's avatar

      .addFields(
        { name: '⭐ Starboard', value: `React to any message containing an image with the ${config.starEmoji.name} emoji. If it gets ${config.requiredStars} stars, it will be posted to the #${config.starboardChannel} channel!`, inline: false },
        { name: `🎨 Theme Submissions`, value: `Post a photo in #${config.photographyChannel} with the hashtag \`${config.themeHashtag}\` to submit it to the monthly theme contest. Your entry will be automatically posted in #${config.themeChannel}.`, inline: false }
      )

      .addFields({ name: '\u200B', value: '__**General Commands**__' }) // Spacer and section title

      .addFields(
        { name: '`!award display [@user]`', value: 'Shows the awards earned by you or another user in a "Trophy Case" embed.', inline: true },
        { name: '`!award top`', value: 'Displays the server-wide awards leaderboard.', inline: true },
        { name: '`!help`', value: 'Displays this help message.', inline: true },
      )

      .addFields({ name: '\u200B', value: '__**Admin & Moderator Commands**__' }) // Spacer and section title

      .addFields(
        { name: '`!award <create|delete|add|remove>`', value: 'Manages the server\'s award system. (Admin only)', inline: false },
        { name: '`!move <#channel> <message_id> [reason]`', value: 'Moves a message with an image/video to another channel.', inline: false },
        { name: '`!setup-reactions`', value: 'Posts the message for self-assigning age roles. (Admin only)', inline: false },
        { name: '`!purge-users`', value: 'Manually runs the purge check for unverified members. (Admin only)', inline: false },
        { name: '`!remind-users`', value: 'Manually runs the reminder check for unverified members. (Admin only)', inline: false },
        { name: '`!backfill-joins`', value: 'One-time command to log join dates for existing members. (Admin only)', inline: false },
      )

      .setFooter({ text: `UrbexWarden v1.2 | For feature help, ask an admin.` })
      .setTimestamp();

    try {
      await message.channel.send({ embeds: [helpEmbed] });
    } catch (error) {
      console.error('Could not send help embed:', error);
    }
  },
};