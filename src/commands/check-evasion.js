// src/commands/check-evasion.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  category: 'Admin',
  data: new SlashCommandBuilder()
    .setName('check-evasion')
    .setDescription('Manually checks a user against the ban evasion criteria.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check.')
        .setRequired(true)),

  async execute(interaction) {
    // 1. Defer the reply to give us time to process
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.options.getMember('user');

    if (!member) {
      return interaction.editReply({ content: 'That user is not in this server.' });
    }

    // 2. Check if the ban evasion system is enabled at all
    if (!config.enableBanEvasion) {
      return interaction.editReply({ content: 'The ban evasion system is currently disabled in the configuration.' });
    }

    // 3. Get user info and calculate account age
    const accountCreationDate = member.user.createdAt;
    const accountAgeDays = (new Date() - accountCreationDate) / (1000 * 3600 * 24);
    const isSuspicious = accountAgeDays < config.banEvasionMaxAccountAgeDays;

    // 4. Build the response embed
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Manual Ban Evasion Check')
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: 'User', value: `${member.user} (${member.id})` },
        { name: 'Account Created', value: `<t:${Math.floor(accountCreationDate.getTime() / 1000)}:R>`, inline: true },
        { name: 'Account Age', value: `${accountAgeDays.toFixed(1)} days`, inline: true }
      )
      .setTimestamp();

    // 5. Adjust embed based on whether the user is suspicious
    if (isSuspicious) {
      embed
        .setColor(0xFF0000) // Red
        .addFields({
          name: 'Result',
          value: `**Flagged as suspicious.** Their account age is less than the configured threshold of **${config.banEvasionMaxAccountAgeDays}** days.`,
        });
    } else {
      embed
        .setColor(0x00FF00) // Green
        .addFields({
          name: 'Result',
          value: `Account appears to be legitimate. Their account age is greater than the configured threshold of **${config.banEvasionMaxAccountAgeDays}** days.`,
        });
    }

    // 6. Send the final reply
    await interaction.editReply({ embeds: [embed] });
  },
};