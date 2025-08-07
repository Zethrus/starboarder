// src/commands/weather.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { geocodeLocation, httpsGet } = require('../utils/network');
const { readDb } = require('../utils/helpers');

function getWeatherEmoji(weatherCode) {
    const emojiMap = {
        0: '☀️', // Clear sky
        1: '🌤️', // Mainly clear
        2: '⛅', // Partly cloudy
        3: '☁️', // Overcast
        45: '🌫️', // Fog
        48: '🌫️', // Depositing rime fog
        51: '💧', // Drizzle, light
        53: '💧', // Drizzle, moderate
        55: '💧', // Drizzle, dense
        56: '❄️💧', // Freezing Drizzle, light
        57: '❄️💧', // Freezing Drizzle, dense
        61: '🌧️', // Rain, slight
        63: '🌧️', // Rain, moderate
        65: '🌧️', // Rain, heavy
        66: '❄️🌧️', // Freezing Rain, light
        67: '❄️🌧️', // Freezing Rain, heavy
        71: '🌨️', // Snow fall, slight
        73: '🌨️', // Snow fall, moderate
        75: '🌨️', // Snow fall, heavy
        77: '❄️', // Snow grains
        80: '🌦️', // Rain showers, slight
        81: '🌦️', // Rain showers, moderate
        82: '🌦️', // Rain showers, violent
        85: '🌨️', // Snow showers, slight
        86: '🌨️', // Snow showers, heavy
        95: '⛈️', // Thunderstorm
        96: '⛈️', // Thunderstorm with slight hail
        99: '⛈️', // Thunderstorm with heavy hail
    };
    return emojiMap[weatherCode] || '❓';
}

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the current weather for a specific location.')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Location to check (e.g., "Edmonton"). Defaults to your saved location.')
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

      // Get weather data from Open-Meteo API
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto`;
      const weatherData = await httpsGet(weatherUrl);

      if (!weatherData.current) {
        throw new Error('Invalid weather data received from API.');
      }

      const { temperature_2m, apparent_temperature, precipitation, weather_code, wind_speed_10m, wind_direction_10m } = weatherData.current;
      const weatherDescription = weatherData.current_units.weather_code;

      const weatherEmbed = new EmbedBuilder()
        .setColor(0x0099FF) // Blue color
        .setTitle(`${getWeatherEmoji(weather_code)} Current Weather in ${display_name}`)
        .setDescription(`**${weatherDescription}**`)
        .addFields(
          { name: 'Temperature', value: `${temperature_2m}°C`, inline: true },
          { name: 'Feels Like', value: `${apparent_temperature}°C`, inline: true },
          { name: 'Precipitation', value: `${precipitation} mm`, inline: true },
          { name: 'Wind Speed', value: `${wind_speed_10m} km/h`, inline: true },
          { name: 'Wind Direction', value: `${wind_direction_10m}°`, inline: true },
        )
        .setFooter({ text: 'Powered by Open-Meteo' })
        .setTimestamp();

      await interaction.editReply({ embeds: [weatherEmbed] });

    } catch (error) {
      console.error('Error in weather command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching weather data. Please try again later.')
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};
