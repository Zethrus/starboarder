// src/commands/setup-reactions.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');
const config = require('../../config');

const ROLE_BUTTON_CONFIG = [
  { emoji: '1️⃣', label: '16-17', roleName: '16-17', style: ButtonStyle.Secondary },
  { emoji: '2️⃣', label: '18-20', roleName: '18-20', style: ButtonStyle.Secondary },
  { emoji: '3️⃣', label: '21-24', roleName: '21-24', style: ButtonStyle.Secondary },
  { emoji: '4️⃣', label: '25-29', roleName: '25-29', style: ButtonStyle.Secondary },
  { emoji: '5️⃣', label: '30-34', roleName: '30-34', style: ButtonStyle.Secondary },
  { emoji: '6️⃣', label: '35-39', roleName: '35-39', style: ButtonStyle.Secondary },
  { emoji: '7️⃣', label: '40+', roleName: '40+', style: ButtonStyle.Secondary },
  { emoji: '🗑️', label: 'Clear Role', roleName: 'clear_age_role', style: ButtonStyle.Danger },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-reactions')
    .setDescription('Sets up the reaction role message in the information channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: 'I need the "Manage Roles" permission to automatically create and assign roles.', ephemeral: true });
    }

    const targetChannel = interaction.guild.channels.cache.find(channel => channel.name === config.reactionRoleChannel);
    if (!targetChannel) {
      return interaction.reply({ content: `The channel #${config.reactionRoleChannel} was not found.`, ephemeral: true });
    }

    await interaction.reply({ content: '⚙️ Setting up reaction roles...', ephemeral: true });

    try {
      for (const config of ROLE_BUTTON_CONFIG) {
        if (config.roleName === 'clear_age_role') continue;
        const roleExists = interaction.guild.roles.cache.some(role => role.name === config.roleName);
        if (!roleExists) {
          await interaction.guild.roles.create({ name: config.roleName, reason: 'Auto-created for reaction roles.' });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Select Your Age Range')
        .setDescription('Click a button to assign yourself an age-range role. This is optional and can be cleared at any time.');

      const components = [];
      let currentRow = new ActionRowBuilder();
      ROLE_BUTTON_CONFIG.forEach(buttonConfig => {
        if (currentRow.components.length === 5) {
          components.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`reaction_role:${buttonConfig.roleName}`)
            .setLabel(buttonConfig.label)
            .setEmoji(buttonConfig.emoji)
            .setStyle(buttonConfig.style)
        );
      });
      if (currentRow.components.length > 0) components.push(currentRow);

      const reactionMessage = await targetChannel.send({ embeds: [embed], components });

      const db = await readDb();
      db.reactionRoleMessageId = reactionMessage.id;
      await writeDb(db);

      await interaction.editReply({ content: `✅ Successfully set up the button role message in ${targetChannel}.` });

    } catch (error) {
      console.error('Failed to set up button roles:', error);
      await interaction.editReply({ content: 'An error occurred. Please check my permissions and the console.' });
    }
  },
  // Exporting this for the interactionCreate event
  ROLE_BUTTON_CONFIG,
};