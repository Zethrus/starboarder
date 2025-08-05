// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands and features.'),

  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('UrbexWarden Help & Feature Guide')
      .setDescription('Here is a list of commands you can use and features to know about.')
      .setThumbnail(interaction.client.user.displayAvatarURL())

      .addFields(
        { name: '⭐ Starboard', value: `React to any message containing an image with the ${config.starEmoji.name} emoji. If it gets ${config.requiredStars} stars, it will be posted to the #${config.starboardChannel} channel!`, inline: false },
        { name: `🎨 Theme Submissions`, value: `Post a photo in #${config.photographyChannel} with the hashtag \`${config.themeHashtag}\` to submit it to the monthly theme contest. Your entry will be automatically posted in #${config.themeChannel}.`, inline: false },
        { name: '🛡️ Ban Evasion Detection', value: `The bot automatically monitors new members. If a user's account is younger than the configured threshold (default: ${config.banEvasionMaxAccountAgeDays} day), an alert will be sent to #${config.banEvasionAlertChannelName} and the action will be logged.`, inline: false }
      )

      .addFields({ name: '\u200B', value: '__**General Commands**__' })

      .addFields(
        { name: '`/award display [@user]`', value: 'Shows the awards earned by you or another user.' },
        { name: '`/award top`', value: 'Displays the server-wide awards leaderboard.' },
        { name: '`/help`', value: 'Displays this help message.' }
      )

      .addFields({ name: '\u200B', value: '__**Admin & Moderator Commands**__' })

      .addFields(
        { name: '`/award <create|delete|add|remove|list>`', value: 'Manages the server\'s award system.' },
        { name: '`/move <#channel> <message_id> [reason]`', value: 'Moves a message with an image/video.' },
        { name: '`/check-evasion <@user>`', value: 'Manually checks a user against ban evasion criteria.' },
        { name: '`/check-alts <@user>`', value: 'Scans for potential alternate accounts of a user.' },
        { name: '`/setup-reactions`', value: 'Posts the message for self-assigning age roles.' },
        { name: '`/purge-users`', value: 'Manually runs the purge check for unverified members.' },
        { name: '`/remind-users`', value: 'Manually runs the reminder check for unverified members.' },
        { name: '`/backfill-joins`', value: 'Logs join dates for existing members (one-time use).' }
      )

      .setFooter({ text: `UrbexWarden v1.1 | For feature help, ask an admin.` })
      .setTimestamp();

    // The old command files are still present, so we'll just check for one to decide if we show this note.
    const awardCommandFile = require('./awards.js');
    if (awardCommandFile && awardCommandFile.name) {
      helpEmbed.addFields({ name: '⚠️ Legacy Commands', value: 'This bot still supports some prefix commands (e.g., `!award`). These are being phased out in favor of slash commands.' });
    }

    try {
      await interaction.reply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error('Could not send help embed:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'There was an error while trying to send the help message!', ephemeral: true });
      }
    }
  },
};