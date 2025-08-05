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

    // Ensure the config value is present, default to 24 if not
    const thresholdHours = config.altAccountThresholdHours || 24;
    const thresholdMilliseconds = thresholdHours * 3600 * 1000;
    const potentialAlts = [];

    const allMembers = await interaction.guild.members.fetch();

    for (const member of allMembers.values()) {
      if (member.id === targetUser.id || member.user.bot) {
        continue;
      }

      const timeDifference = Math.abs(targetUser.createdAt - member.user.createdAt);

      if (timeDifference <= thresholdMilliseconds) {
        potentialAlts.push(member);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Alternate Account Check')
      .setColor(potentialAlts.length > 0 ? 0xFF0000 : 0x00FF00)
      .addFields(
        { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})` },
        { name: 'Target Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>` }
      )
      .setFooter({ text: `Checked against ${allMembers.size} members with a ${thresholdHours}-hour threshold.` })
      .setTimestamp();

    if (potentialAlts.length > 0) {
      // Sort alts by creation date to see the order
      potentialAlts.sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp);

      const altField = potentialAlts
        .map(alt => {
          const avatarStatus = alt.user.avatar === null ? ' (Default Avatar)' : '';
          return `**${alt.user.tag}**${avatarStatus}\n` +
            `*Created:* <t:${Math.floor(alt.user.createdTimestamp / 1000)}:R>\n` +
            `*Joined Server:* <t:${Math.floor(alt.joinedTimestamp / 1000)}:R>`;
        })
        .join('\n\n');

      embed.addFields({ name: '🚨 Potential Alts Found', value: altField });
    } else {
      embed.addFields({ name: '✅ No Potential Alts Found', value: 'No other members were found with a similar account creation time.' });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};