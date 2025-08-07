// src/commands/raintoday.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

// Helper function to make HTTP requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Discord Bot - RainToday' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

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

      // Geocode the location using OpenStreetMap Nominatim API
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
      const geocodeData = await httpsGet(geocodeUrl);

      if (geocodeData.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Location Not Found')
          .setDescription(`Could not find location: **${location}**\n\nPlease try with a more specific location (e.g., "New York, NY", "London, UK", "Tokyo, Japan").`)
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const { lat, lon, display_name } = geocodeData[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

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
