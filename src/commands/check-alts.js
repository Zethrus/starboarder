// src/commands/check-alts.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-alts')
    .setDescription('Scans server members for possible alternate accounts of a user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to investigate for possible alternate accounts.')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const targetMember = interaction.options.getMember('user');

    if (!targetMember) {
      return interaction.editReply({ content: 'That user is not currently in this server.' });
    }

    const thresholdMilliseconds = (config.altAccountThresholdHours || 24) * 3600 * 1000;
    const potentialAlts = [];

    // Fetch all members from the guild to ensure we have the full list
    const allMembers = await interaction.guild.members.fetch();

    // Iterate through every member in the server
    for (const member of allMembers.values()) {
      // Skip the target user themselves and any bots
      if (member.id === targetUser.id || member.user.bot) {
        continue;
      }

      const timeDifference = Math.abs(targetUser.createdAt - member.user.createdAt);

      if (timeDifference <= thresholdMilliseconds) {
        potentialAlts.push(member);
      }
    }

    // Build the response embed
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Alternate Account Check')
      .setColor(potentialAlts.length > 0 ? 0xFF0000 : 0x00FF00) // Red if alts found, Green if not
      .addFields(
        { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})` },
        { name: 'Target Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>` }
      )
      .setFooter({ text: `Checked against ${allMembers.size} members with a ${config.altAccountThresholdHours || 24}-hour threshold.` })
      .setTimestamp();

    if (potentialAlts.length > 0) {
      const altField = potentialAlts
        .map(alt => `**${alt.user.tag}** (<t:${Math.floor(alt.user.createdTimestamp / 1000)}:R>)`)
        .join('\n');

      embed.addFields({ name: '🚨 Potential Alts Found', value: altField });
    } else {
      embed.addFields({ name: '✅ No Potential Alts Found', value: 'No other members were found with a similar account creation time.' });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};