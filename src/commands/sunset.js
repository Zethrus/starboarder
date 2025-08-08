// src/commands/sunset.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const SunCalc = require('suncalc');
const { geocodeLocation } = require('../utils/network');
const { readDb } = require('../utils/helpers');

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('sunset')
    .setDescription('Get sunset time for a specific location')
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
      
      // Calculate sunset time for today
      const today = new Date();
      const times = SunCalc.getTimes(today, latitude, longitude);
      
      // Format sunset time
      const sunsetTime = times.sunset;
      const formattedTime = sunsetTime.toLocaleTimeString('en-US', {
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
      
      // Check if sunset has already passed today
      const now = new Date();
      let timeDescription = '';
      if (now > sunsetTime) {
        const timeDiff = Math.floor((now - sunsetTime) / (1000 * 60)); // minutes
        if (timeDiff < 60) {
          timeDescription = `(${timeDiff} minute${timeDiff !== 1 ? 's' : ''} ago)`;
        } else {
          const hours = Math.floor(timeDiff / 60);
          timeDescription = `(${hours} hour${hours !== 1 ? 's' : ''} ago)`;
        }
      } else {
        const timeDiff = Math.floor((sunsetTime - now) / (1000 * 60)); // minutes
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
      
      const sunsetEmbed = new EmbedBuilder()
        .setColor(0xFF6B35) // Sunset orange color
        .setTitle('🌅 Sunset Time')
        .setDescription(`**Location:** ${displayName}\n**Date:** ${formattedDate}\n**Sunset:** ${formattedTime} ${timeDescription}`)
        .addFields(
          { name: 'Coordinates', value: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`, inline: true },
          { name: 'UTC Time', value: sunsetTime.toUTCString().split(' ')[4], inline: true }
        )
        .setFooter({ text: 'Times are calculated for your local timezone' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [sunsetEmbed] });
      
    } catch (error) {
      console.error('Error in sunset command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching sunset data. Please try again later.')
        .setTimestamp();
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] });
      }
    }
  },
};
