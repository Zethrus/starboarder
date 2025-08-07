// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands and features.'),

  async execute(interaction) {
    const { commands } = interaction.client;

    // Group commands by category
    const categories = {
        'General': [],
        'Admin': []
    };

    commands.forEach(command => {
        // Ensure the command has a category and it's one we're expecting
        if (command.category && categories.hasOwnProperty(command.category)) {
            // Exclude the help command itself from the list
            if (command.data.name === 'help') return;
            categories[command.category].push(command);
        }
    });

    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099FF) // Light blue color
      .setTitle('UrbexWarden Help & Feature Guide')
      .setDescription('Here is a list of commands you can use and features to know about.')
      .setThumbnail(interaction.client.user.displayAvatarURL()); // Shows the bot's avatar

      // Static Features Section
      helpEmbed.addFields(
        { name: '⭐ Starboard', value: `React to any message containing an image with the ${config.starEmoji.name} emoji. If it gets ${config.requiredStars} stars, it will be posted to the #${config.starboardChannel} channel!`, inline: false },
        { name: `🎨 Theme Submissions`, value: `Post a photo in #${config.photographyChannel} with the hashtag \`${config.themeHashtag}\` to submit it to the monthly theme contest. Your entry will be automatically posted in #${config.themeChannel}.`, inline: false },
        { name: '🛡️ Ban Evasion Detection', value: `The bot automatically monitors new members. If a user's account is younger than the configured threshold (default: ${config.banEvasionMaxAccountAgeDays} day), an alert will be sent to #${config.banEvasionAlertChannelName} and the action will be logged.`, inline: false }
      );

      // Dynamically add command categories and their commands
      for (const category in categories) {
          const commandsInCategory = categories[category];
          if (commandsInCategory.length > 0) {
              const commandList = commandsInCategory
                .map(cmd => `**\`/${cmd.data.name}\`**: ${cmd.data.description}`)
                .join('\n');
              helpEmbed.addFields({ name: `\u200B\n__**${category} Commands**__`, value: commandList });
          }
      }

      helpEmbed
      .setFooter({ text: `UrbexWarden v1.2.1 | For feature help, ask an admin.` })
      .setTimestamp();

    try {
      await interaction.reply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error('Could not send help embed:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while trying to send the help message!', ephemeral: true });
      } else {
        await interaction.editReply({ content: 'There was an error while trying to send the help message!', ephemeral: true });
      }
    }
  },
};
