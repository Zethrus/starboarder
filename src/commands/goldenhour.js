// src/commands/goldenhour.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SunCalc = require('suncalc');
const { geocodeLocation } = require('../utils/network');
const { readDb } = require('../utils/helpers');

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('goldenhour')
    .setDescription('Get golden hour times for a specific location.')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('The location to get golden hour times for (e.g., "New York", "London", "Tokyo")')
        .setRequired(false)
    ),

  async execute(interaction) {
    let location = interaction.options.getString('location');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply();

      if (!location) {
        const db = await readDb();
        const userLocation = db.userLocations[userId];

        if (userLocation) {
          location = userLocation;
        } else {
          const noLocationEmbed = new EmbedBuilder()
            .setColor(0xFFCC00) // Yellow color for warning
            .setTitle('📍 No Location Set')
            .setDescription('You have not set a default location.\n\nPlease use the `/set-location` command to set your default location, or provide a location with this command (e.g., `/goldenhour New York`).')
            .setTimestamp();

          await interaction.editReply({ embeds: [noLocationEmbed] });
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
        .setDescription(`**Location:** ${displayName}\n**Date:** ${formattedDate}`)
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
