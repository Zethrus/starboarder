// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands and features.'),

  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF) // Light blue color
      .setTitle('UrbexWarden Help & Feature Guide')
      .setDescription('Here is a list of commands you can use and features to know about.')
      .setThumbnail(interaction.client.user.displayAvatarURL()) // Shows the bot's avatar

      .addFields(
        { name: '⭐ Starboard', value: `React to any message containing an image with the ${config.starEmoji.name} emoji. If it gets ${config.requiredStars} stars, it will be posted to the #${config.starboardChannel} channel!`, inline: false },
        { name: `🎨 Theme Submissions`, value: `Post a photo in #${config.photographyChannel} with the hashtag \`${config.themeHashtag}\` to submit it to the monthly theme contest. Your entry will be automatically posted in #${config.themeChannel}.`, inline: false },
        { name: '🛡️ Ban Evasion Detection', value: `The bot automatically monitors new members. If a user's account is younger than the configured threshold (default: ${config.banEvasionMaxAccountAgeDays} day), an alert will be sent to #${config.banEvasionAlertChannelName} and the action will be logged.`, inline: false }
      )

      .addFields({ name: '\u200B', value: '__**General Commands**__' }) // Spacer and section title

      .addFields(
        { name: '`/award display [@user]`', value: 'Shows the awards earned by you or another user.', inline: true },
        { name: '`/award top`', value: 'Displays the server-wide awards leaderboard.', inline: true },
        { name: '`/help`', value: 'Displays this help message.', inline: true },
        { name: '`/sunrise <location>`', value: 'Get sunrise time for a specific location.', inline: true },
        { name: '`/sunset <location>`', value: 'Get sunset time for a specific location.', inline: true },
      )

      .addFields({ name: '\u200B', value: '__**Admin & Moderator Commands**__' }) // Spacer and section title

      .addFields(
        { name: '`/award <add|remove|create|delete>`', value: 'Manages the server\'s award system.', inline: false },
        { name: '`/award list`', value: 'Lists all created awards available to be given.', inline: false },
        { name: '`/move <#channel> <message_id> [reason]`', value: 'Moves a message with an image/video to another channel.', inline: false },
        { name: '`/check-evasion <@user>`', value: 'Manually checks a user against ban evasion criteria.', inline: false },
        { name: '`/check-alts <@user>`', value: 'Scans for potential alternate accounts of a user.', inline: false },
        { name: '`/setup-reactions`', value: 'Posts the message for self-assigning age roles.', inline: false },
        { name: '`/purge-users`', value: 'Manually runs the purge check for unverified members.', inline: false },
        { name: '`/remind-users`', value: 'Manually runs the reminder check for unverified members.', inline: false },
        { name: '`/backfill-joins`', value: 'One-time command to log join dates for existing members.', inline: false },
      )

      .setFooter({ text: `UrbexWarden v1.2.1 | For feature help, ask an admin.` })
      .setTimestamp();

    try {
      // Reply to the interaction instead of sending a message to the channel
      await interaction.reply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error('Could not send help embed:', error);
      // It's good practice to inform the user if something goes wrong
      if (!interaction.replied) {
        await interaction.reply({ content: 'There was an error while trying to send the help message!', ephemeral: true });
      }
    }
  },
};