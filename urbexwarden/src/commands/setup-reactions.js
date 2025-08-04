// src/commands/setup-reactions.js
const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readDb, writeDb, replyThenDelete } = require('../utils/helpers');
const config = require('../../config');

// --- CONFIGURATION FOR ROLE BUTTONS ---
// CORRECTED: Replaced invalid emoji characters with standard Unicode emojis.
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
// -----------------------------------------

module.exports = {
  name: 'setup-reactions',
  description: 'Sets up the reaction role message in the specified channel.',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return replyThenDelete(message, 'You must be an Administrator to run this command.');
    }
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return replyThenDelete(message, 'I need the "Manage Roles" permission to automatically create roles.');
    }

    const targetChannel = message.guild.channels.cache.find(
      channel => channel.name === config.reactionRoleChannel
    );
    if (!targetChannel) {
      return replyThenDelete(message, `The channel #${config.reactionRoleChannel} was not found.`);
    }

    try {
      // --- AUTOMATIC ROLE CREATION ---
      console.log('[ROLES] Checking for and creating missing roles...');
      const rolesToCreate = ROLE_BUTTON_CONFIG.filter(config => config.roleName !== 'clear_age_role');

      for (const config of rolesToCreate) {
        const roleExists = message.guild.roles.cache.some(role => role.name === config.roleName);
        if (!roleExists) {
          await message.guild.roles.create({
            name: config.roleName,
            reason: 'Auto-created for reaction roles by bot.',
          });
          console.log(`[ROLES] Created role: ${config.roleName}`);
        }
      }
      console.log('[ROLES] Role check complete.');
      // -------------------------------

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Select Your Age Range')
        .setDescription('Click the button that corresponds to your age range to get the appropriate role. This is optional and helps personalize your experience. You can click "Clear Role" to remove it.');

      const components = [];
      let currentRow = new ActionRowBuilder();

      for (const buttonConfig of ROLE_BUTTON_CONFIG) {
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
      }
      if (currentRow.components.length > 0) {
        components.push(currentRow);
      }

      const reactionMessage = await targetChannel.send({ embeds: [embed], components: components });

      const db = await readDb();
      db.reactionRoleMessageId = reactionMessage.id;
      await writeDb(db);

      await message.delete();
      console.log(`[REACTIONS] Successfully set up button role message with ID: ${reactionMessage.id}`);

    } catch (error) {
      console.error('Failed to set up button roles:', error);
      await replyThenDelete(message, 'An error occurred. Please check my permissions and try again.');
    }
  },
};

module.exports.ROLE_BUTTON_CONFIG = ROLE_BUTTON_CONFIG;