// src/commands/set-location.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { geocodeLocation } = require('../utils/network');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('set-location')
    .setDescription('Sets your default location for weather, sunrise, and sunset commands.')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Your desired default location (e.g., "Edmonton", "London, UK")')
        .setRequired(true)
    ),

  async execute(interaction) {
    const location = interaction.options.getString('location');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      const geocodeData = await geocodeLocation(location);

      if (!geocodeData) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Location Not Found')
          .setDescription(`Could not validate location: **${location}**\n\nPlease try with a more specific location (e.g., "New York, NY", "London, UK").`)
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const { displayName } = geocodeData;

      const db = await readDb();
      db.userLocations[userId] = displayName;
      await writeDb(db);

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Location Set')
        .setDescription(`Your default location has been set to **${displayName}**.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      console.error('Error in set-location command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while setting your location. Please try again later.')
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};
