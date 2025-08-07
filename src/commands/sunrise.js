// src/commands/sunrise.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SunCalc = require('suncalc');
const { geocodeLocation } = require('../utils/network');
const { readDb } = require('../utils/helpers');

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('sunrise')
    .setDescription('Get sunrise time for a specific location')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Location to check (e.g., "New York"). Defaults to your saved location.')
        .setRequired(false)
    ),

  async execute(interaction) {
    let location = interaction.options.getString('location');
    const userId = interaction.user.id;
    
    try {
      await interaction.deferReply();

      if (!location) {
        const db = await readDb();
        location = db.userLocations?.[userId];
        if (!location) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFFCC00)
            .setTitle('⚠️ No Location Set')
            .setDescription('You have not set a default location.\nUse the `/set-location` command to save your preferred location, or provide one in the command.')
            .setTimestamp();
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }
      }

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
