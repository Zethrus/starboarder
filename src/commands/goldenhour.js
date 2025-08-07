// src/commands/goldenhour.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SunCalc = require('suncalc');
const https = require('https');

// Helper function to make HTTP requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Discord Bot - GoldenHour' } }, (res) => {
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
    .setName('goldenhour')
    .setDescription('Get golden hour times for a specific location.')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('The location to get golden hour times for (e.g., "New York", "London", "Tokyo")')
        .setRequired(true)
    ),

  async execute(interaction) {
    const location = interaction.options.getString('location');

    try {
      await interaction.deferReply();

      // Geocode the location using OpenStreetMap Nominatim API (free, no key required)
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

      // Calculate golden hour times for today
      const today = new Date();
      const times = SunCalc.getTimes(today, latitude, longitude);

      // Format golden hour times
      const morningGoldenHourEnd = times.goldenHourEnd;
      const eveningGoldenHourStart = times.goldenHour;

      const formattedMorningTime = morningGoldenHourEnd.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });

      const formattedEveningTime = eveningGoldenHourStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });

      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const goldenHourEmbed = new EmbedBuilder()
        .setColor(0xFFD700) // Golden color
        .setTitle('🌇 Golden Hour Times')
        .setDescription(`**Location:** ${display_name}\n**Date:** ${formattedDate}`)
        .addFields(
          { name: 'Morning Golden Hour Ends', value: formattedMorningTime, inline: true },
          { name: 'Evening Golden Hour Starts', value: formattedEveningTime, inline: true }
        )
        .setFooter({ text: 'Times are calculated for your local timezone' })
        .setTimestamp();

      await interaction.editReply({ embeds: [goldenHourEmbed] });

    } catch (error) {
      console.error('Error in goldenhour command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching golden hour data. Please try again later.')
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed] });
      }
    }
  },
};
