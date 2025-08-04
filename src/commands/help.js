const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  /**
   * The 'data' property defines the command for Discord's API.
   * It is used by the deploy-commands.js script to register the command.
   */
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands and features.'),

  /**
   * The 'execute' function contains the actual logic for the command.
   * It receives an 'interaction' object, which represents the slash command execution.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction The interaction object.
   */
  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF) // Light blue color
      .setTitle('UrbexWarden Help & Feature Guide')
      .setDescription('Here is a list of commands you can use and features to know about.')
      .setThumbnail(interaction.client.user.displayAvatarURL()) // Shows the bot's avatar

      .addFields(
        { name: '⭐ Starboard', value: `React to any message containing an image with the ${config.starEmoji.name} emoji. If it gets ${config.requiredStars} stars, it will be posted to the #${config.starboardChannel} channel!`, inline: false },
        { name: `🎨 Theme Submissions`, value: `Post a photo in #${config.photographyChannel} with the hashtag \`${config.themeHashtag}\` to submit it to the monthly theme contest. Your entry will be automatically posted in #${config.themeChannel}.`, inline: false }
      )

      .addFields({ name: '\u200B', value: '__**General Commands**__' }) // Spacer and section title

      .addFields(
        { name: '`/award display [@user]`', value: 'Shows the awards earned by you or another bot in a "Trophy Case" embed.', inline: true },
        { name: '`/award top`', value: 'Displays the server-wide awards leaderboard.', inline: true },
        { name: '`/help`', value: 'Displays this help message.', inline: true },
      )

      .addFields({ name: '\u200B', value: '__**Admin & Moderator Commands**__' }) // Spacer and section title

      .addFields(
        { name: '`/award <create|delete|add|remove>`', value: 'Manages the server\'s award system. (Admin only)', inline: false },
        { name: '`/award list`', value: 'Lists all created awards available to be given. (Admin only)', inline: false },
        { name: '`/award create <name> <role> [image]`', value: 'Creates a new award with an optional image URL linked to a role. (Admin only)', inline: false },
        { name: '`/move <#channel> <message_id> [reason]`', value: 'Moves a message with an image/video to another channel.', inline: false },
        { name: '`/setup-reactions`', value: 'Posts the message for self-assigning age roles. (Admin only)', inline: false },
        { name: '`/purge-users`', value: 'Manually runs the purge check for unverified members. (Admin only)', inline: false },
        { name: '`/remind-users`', value: 'Manually runs the reminder check for unverified members. (Admin only)', inline: false },
        { name: '`/backfill-joins`', value: 'One-time command to log join dates for existing members. (Admin only)', inline: false },
      )

      .setFooter({ text: `UrbexWarden v1.1 | For feature help, ask an admin.` })
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