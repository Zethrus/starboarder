// src/commands/raintoday.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { geocodeLocation, httpsGet } = require('../utils/network');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raintoday')
    .setDescription('Check the probability of rain for a specific location.')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('The location to check for rain (e.g., "Edmonton", "London", "Tokyo")')
        .setRequired(true)
    ),

  async execute(interaction) {
    const location = interaction.options.getString('location');

    try {
      await interaction.deferReply();

      const geocodeData = await geocodeLocation(location);

      if (!geocodeData) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Location Not Found')
          .setDescription(`Could not find location: **${location}**\n\nPlease try with a more specific location (e.g., "New York, NY", "London, UK", "Tokyo, Japan").`)
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const { latitude, longitude, displayName } = geocodeData;

      // Get weather data from Open-Meteo API
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=precipitation_probability_max&timezone=auto`;
      const weatherData = await httpsGet(weatherUrl);

      if (!weatherData.daily || !weatherData.daily.precipitation_probability_max) {
        throw new Error('Invalid weather data received from API.');
      }

      const rainProbability = weatherData.daily.precipitation_probability_max[0];

      const rainEmbed = new EmbedBuilder()
        .setColor(0x0099FF) // Blue color for rain
        .setTitle(`☔ Rain Probability: ${rainProbability}%`)
        .setDescription(`**Location:** ${display_name}`)
        .addFields(
          { name: 'Coordinates', value: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`, inline: true }
        )
        .setFooter({ text: 'Powered by Open-Meteo' })
        .setTimestamp();

      await interaction.editReply({ embeds: [rainEmbed] });

    } catch (error) {
      console.error('Error in raintoday command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching rain probability data. Please try again later.')
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};
