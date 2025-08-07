// src/commands/moonphase.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SunCalc = require('suncalc');

function getMoonEmoji(phase) {
    if (phase < 0.06 || phase > 0.94) return '🌑'; // New Moon
    if (phase < 0.18) return '🌒'; // Waxing Crescent
    if (phase < 0.31) return '🌓'; // First Quarter
    if (phase < 0.44) return '🌔'; // Waxing Gibbous
    if (phase < 0.56) return '🌕'; // Full Moon
    if (phase < 0.69) return '🌖'; // Waning Gibbous
    if (phase < 0.82) return '🌗'; // Last Quarter
    if (phase < 0.94) return '🌘'; // Waning Crescent
    return '❓';
}

function getMoonPhaseName(phase) {
    if (phase < 0.06 || phase > 0.94) return 'New Moon';
    if (phase < 0.18) return 'Waxing Crescent';
    if (phase < 0.31) return 'First Quarter';
    if (phase < 0.44) return 'Waxing Gibbous';
    if (phase < 0.56) return 'Full Moon';
    if (phase < 0.69) return 'Waning Gibbous';
    if (phase < 0.82) return 'Last Quarter';
    if (phase < 0.94) return 'Waning Crescent';
    return 'Unknown Phase';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moonphase')
    .setDescription('Shows the current phase of the moon.'),

  async execute(interaction) {
    try {
        await interaction.deferReply();

        const moonIllumination = SunCalc.getMoonIllumination(new Date());
        const moonPhase = moonIllumination.phase;

        const moonEmbed = new EmbedBuilder()
            .setColor(0xCCCCCC) // Light grey color
            .setTitle(`${getMoonEmoji(moonPhase)} Current Moon Phase`)
            .setDescription(`**${getMoonPhaseName(moonPhase)}**`)
            .addFields(
                { name: 'Illumination', value: `${(moonIllumination.fraction * 100).toFixed(2)}%`, inline: true },
            )
            .setFooter({ text: 'Powered by SunCalc' })
            .setTimestamp();

        await interaction.editReply({ embeds: [moonEmbed] });

    } catch (error) {
      console.error('Error in moonphase command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching the moon phase. Please try again later.')
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};
