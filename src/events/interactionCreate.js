// src/events/interactionCreate.js
const { Events, MessageFlags } = require('discord.js');
const { ROLE_BUTTON_CONFIG } = require('../commands/setup-reactions.js');

// Create a Set of all possible age role names for quick lookups
const allAgeRoleNames = new Set(ROLE_BUTTON_CONFIG.map(config => config.roleName));

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // We only care about button clicks
    if (!interaction.isButton()) return;

    // We only care about buttons with our specific custom ID prefix
    if (!interaction.customId.startsWith('reaction_role:')) return;

    // Get the role name from the button's custom ID (e.g., 'reaction_role:16-17' -> '16-17')
    const roleNameToAdd = interaction.customId.split(':')[1];

    // --- ROLE MANAGEMENT LOGIC ---
    try {
      const member = interaction.member;
      const guildRoles = interaction.guild.roles.cache;

      // Find the role object the user wants to add
      const roleToAdd = guildRoles.find(r => r.name === roleNameToAdd);
      if (!roleToAdd) {
        console.error(`[REACTIONS] Role "${roleNameToAdd}" not found on the server.`);
        // CORRECTED: Using flags instead of ephemeral: true
        await interaction.reply({ content: 'An error occurred: The role for this button could not be found.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      // Get a list of all age roles the user *currently* has
      const userRolesToRemove = member.roles.cache.filter(role => allAgeRoleNames.has(role.name));

      // Remove all existing age roles from the user
      if (userRolesToRemove.size > 0) {
        await member.roles.remove(userRolesToRemove);
      }

      // Add the new role
      await member.roles.add(roleToAdd);

      // Send a private confirmation message
      // CORRECTED: Using flags instead of ephemeral: true
      await interaction.reply({
        content: `You have been given the **${roleToAdd.name}** role!`,
        flags: [MessageFlags.Ephemeral]
      });

      console.log(`[REACTIONS] Assigned role "${roleToAdd.name}" to user ${interaction.user.tag}.`);

    } catch (error) {
      console.error('Error handling reaction role update:', error);
      // CORRECTED: Using flags instead of ephemeral: true
      await interaction.reply({ content: 'Sorry, there was an error trying to update your roles. Please try again later.', flags: [MessageFlags.Ephemeral] });
    }
  },
};
