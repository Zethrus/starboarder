// src/commands/help.js
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'help',
  description: 'Displays a list of all available commands.',
  async execute(message, args) {

    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF) // Light blue color
      .setTitle('UrbexWarden Help')
      .setDescription('Here is a list of commands you can use.')
      .setThumbnail(message.client.user.displayAvatarURL()) // Shows the bot's avatar
      .addFields(
        { name: 'General Commands', value: 'These commands are available to everyone.' },
        { name: '`!award display [@user]`', value: 'Shows the awards earned by you or another user.', inline: true },
        { name: '`!award top`', value: 'Displays the server-wide awards leaderboard.', inline: true },
        { name: '`!help`', value: 'Displays this help message.', inline: true },
      )
      .addFields(
        { name: '\u200B', value: '\u200B' }, // Spacer
        { name: 'Admin & Moderator Commands', value: 'You must have "Administrator" or "Manage Messages" permissions for these.' },
        { name: '`!award <create|delete|add|remove>`', value: 'Manages the server\'s award system. (Admin only)', inline: false },
        { name: '`!move <#channel> <message_id>`', value: 'Moves a message with an image/video to another channel.', inline: false },
        { name: '`!setup-reactions`', value: 'Posts the message for self-assigning age roles. (Admin only)', inline: false },
        { name: '`!backfill-joins`', value: 'One-time command to log join dates for existing members. (Admin only)', inline: false },
        { name: '`!purge-users`', value: 'Manually runs the purge check for unverified members. (Admin only)', inline: false },
        { name: '`!remind-users`', value: 'Manually runs the reminder check for unverified members. (Admin only)', inline: false },
      )
      .setFooter({ text: `UrbexWarden v1.1 | For feature help, ask an admin.` })
      .setTimestamp();

    try {
      await message.channel.send({ embeds: [helpEmbed] });
    } catch (error) {
      console.error('Could not send help embed:', error);
    }
  },
};