// src/commands/sunrise.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SunCalc = require('suncalc');
const https = require('https');

// Helper function to make HTTP requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Discord Bot - Starboarder' } }, (res) => {
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
    .setName('sunrise')
    .setDescription('Get sunrise time for a specific location')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('The location to get sunrise time for (e.g., "New York", "London", "Tokyo")')
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
      
      // Calculate sunrise time for today
      const today = new Date();
      const times = SunCalc.getTimes(today, latitude, longitude);
      
      // Format sunrise time
      const sunriseTime = times.sunrise;
      const formattedTime = sunriseTime.toLocaleTimeString('en-US', {
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
      
      // Check if sunrise has already passed today
      const now = new Date();
      let timeDescription = '';
      if (now > sunriseTime) {
        const timeDiff = Math.floor((now - sunriseTime) / (1000 * 60)); // minutes
        if (timeDiff < 60) {
          timeDescription = `(${timeDiff} minute${timeDiff !== 1 ? 's' : ''} ago)`;
        } else {
          const hours = Math.floor(timeDiff / 60);
          timeDescription = `(${hours} hour${hours !== 1 ? 's' : ''} ago)`;
        }
      } else {
        const timeDiff = Math.floor((sunriseTime - now) / (1000 * 60)); // minutes
        if (timeDiff < 60) {
          timeDescription = `(in ${timeDiff} minute${timeDiff !== 1 ? 's' : ''})`;
        } else {
          const hours = Math.floor(timeDiff / 60);
          const remainingMinutes = timeDiff % 60;
          if (remainingMinutes === 0) {
            timeDescription = `(in ${hours} hour${hours !== 1 ? 's' : ''})`;
          } else {
            timeDescription = `(in ${hours}h ${remainingMinutes}m)`;
          }
        }
      }
      
      const sunriseEmbed = new EmbedBuilder()
        .setColor(0xFFD700) // Sunrise golden color
        .setTitle('🌄 Sunrise Time')
        .setDescription(`**Location:** ${display_name}\n**Date:** ${formattedDate}\n**Sunrise:** ${formattedTime} ${timeDescription}`)
        .addFields(
          { name: 'Coordinates', value: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`, inline: true },
          { name: 'UTC Time', value: sunriseTime.toUTCString().split(' ')[4], inline: true }
        )
        .setFooter({ text: 'Times are calculated for your local timezone' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [sunriseEmbed] });
      
    } catch (error) {
      console.error('Error in sunrise command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching sunrise data. Please try again later.')
        .setTimestamp();
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed] });
      }
    }
  },
};
