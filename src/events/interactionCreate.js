// src/events/interactionCreate.js
const { Events, MessageFlags, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ROLE_BUTTON_CONFIG } = require('../commands/setup-reactions.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

// Create a Set of all actual age role names for quick lookups, excluding the special 'clear' action
const allAgeRoleNames = new Set(
  ROLE_BUTTON_CONFIG.filter(config => config.roleName !== 'clear_age_role')
    .map(config => config.roleName)
);

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // --- SLASH COMMAND HANDLER ---
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing /${interaction.commandName}`);
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
      return; // End execution after handling the command
    }

    // --- BUTTON INTERACTION HANDLER ---
    if (interaction.isButton()) {
      if (interaction.customId === 'rules_agree') {
        try {
          const db = await readDb();
          if (!db.verificationProgress) db.verificationProgress = {};
          if (!db.verificationProgress[interaction.user.id]) {
            db.verificationProgress[interaction.user.id] = {};
          }

          if (db.verificationProgress[interaction.user.id].agreedToRules) {
            return interaction.reply({
              content: 'You have already agreed to the rules.',
              ephemeral: true
            });
          }

          db.verificationProgress[interaction.user.id].agreedToRules = true;
          await writeDb(db);

          return interaction.reply({
            content: 'Thank you for agreeing to the server rules! You may now proceed with the other verification steps.',
            ephemeral: true
          });

        } catch (error) {
          console.error("Error handling rule agreement:", error);
          return interaction.reply({ content: 'An error occurred while processing your agreement. Please try again.', ephemeral: true });
        }
      }
      // --- REACTION ROLE BUTTONS ---
      if (interaction.customId.startsWith('reaction_role:')) {
        const action = interaction.customId.split(':')[1];
        const member = interaction.member;
        const logChannel = interaction.guild.channels.cache.find(channel => channel.name === config.logChannelName);

        // --- HANDLE UNDER 16 KICK ---
        if (action === 'kick_under_16') {
          if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
            // This message is for the server admin, in case the bot lacks permissions.
            return interaction.reply({ content: 'I do not have the "Kick Members" permission to perform this action.', ephemeral: true });
          }

          try {
            // Send a DM to the user before kicking them
            await member.send(`You have been removed from **${interaction.guild.name}** because you have indicated you are under the age of 16, which is against the server's policy.`);
          } catch (dmError) {
            console.error(`Could not DM user ${member.user.tag} before kicking.`);
          }

          // Kick the user
          await member.kick('User selected the "Under 16" role.');

          // Log the action for moderators
          if (logChannel) {
            await logChannel.send(`👢 **User Kicked**: ${member.user.tag} (${member.id}) was automatically kicked for selecting the "Under 16" role.`);
          }

          // The user will be gone, so this reply won't be seen by them, but it's good practice to acknowledge the interaction.
          return interaction.reply({ content: 'The action has been processed.', ephemeral: true });
        }
        // --- END OF KICK LOGIC ---


        try {
          const userRolesToRemove = member.roles.cache.filter(role => allAgeRoleNames.has(role.name));

          if (action === 'clear_age_role') {
            if (userRolesToRemove.size > 0) {
              await member.roles.remove(userRolesToRemove);
              await interaction.reply({ content: 'Your age role has been successfully removed.', flags: [MessageFlags.Ephemeral] });
              const logMessage = `👤 **Role Update**: ${interaction.user.tag} cleared their age role.`;
              if (logChannel) await logChannel.send(logMessage);
            } else {
              await interaction.reply({ content: 'You do not currently have an age role to remove.', flags: [MessageFlags.Ephemeral] });
            }
            return;
          }

          const roleNameToAdd = action;
          const roleToAdd = interaction.guild.roles.cache.find(r => r.name === roleNameToAdd);

          if (!roleToAdd) {
            console.error(`[REACTIONS] Role "${roleNameToAdd}" not found on the server.`);
            await interaction.reply({ content: 'An error occurred: The role for this button could not be found.', flags: [MessageFlags.Ephemeral] });
            return;
          }

          if (userRolesToRemove.size > 0) {
            await member.roles.remove(userRolesToRemove);
          }

          await member.roles.add(roleToAdd);

          await interaction.reply({
            content: `You have been given the **${roleToAdd.name}** role!`,
            flags: [MessageFlags.Ephemeral]
          });
          const logMessage = `👤 **Role Update**: ${interaction.user.tag} self-assigned the **${roleToAdd.name}** role.`;
          console.log(`[REACTIONS] Assigned role "${roleToAdd.name}" to user ${interaction.user.tag}.`);
          if (logChannel) await logChannel.send(logMessage);

        } catch (error) {
          console.error('Error handling reaction role update:', error);
          await interaction.reply({ content: 'Sorry, there was an error trying to update your roles. Please try again later.', flags: [MessageFlags.Ephemeral] });
        }
      }

      // --- BAN EVASION BUTTONS ---
      if (interaction.customId.startsWith('evasion_')) {
        const [action, targetId] = interaction.customId.split(':');

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'You must be an Administrator to use these buttons.', ephemeral: true });
        }

        if (action === 'ignore') {
          await interaction.message.delete();
          return interaction.reply({ content: 'Alert ignored and removed.', ephemeral: true });
        }

        if (action === 'ban') {
          const memberToBan = await interaction.guild.members.fetch(targetId).catch(() => null);

          if (!memberToBan) {
            await interaction.message.edit({ content: 'This user is no longer in the server.', components: [] });
            return interaction.reply({ content: 'Could not find that user. They may have already left.', ephemeral: true });
          }

          try {
            const reason = `Manually banned by ${interaction.user.tag} via ban evasion alert.`;
            await memberToBan.ban({ reason });

            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
              .setColor(0x800080)
              .addFields({ name: 'Moderator Action', value: `**Banned** by ${interaction.user}.` })
              .setTimestamp(new Date());

            await interaction.message.edit({
              content: `**Action Taken:** The user **${memberToBan.user.tag}** has been banned.`,
              embeds: [updatedEmbed],
              components: []
            });

            return interaction.reply({ content: `Successfully banned ${memberToBan.user.tag}.`, ephemeral: true });

          } catch (error) {
            console.error('Failed to ban user from evasion alert:', error);
            return interaction.reply({ content: 'An error occurred while trying to ban the user. Please check my permissions.', ephemeral: true });
          }
        }
      }
    }
  },
};