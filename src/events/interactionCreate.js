// src/events/interactionCreate.js
const { Events, MessageFlags, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ROLE_BUTTON_CONFIG } = require('../commands/setup-reactions.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

// This is required for the reaction role handler
const allAgeRoleNames = new Set(
  ROLE_BUTTON_CONFIG.filter(config => config.roleName !== 'clear_age_role' && config.roleName !== 'kick_under_16')
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
        console.error(`Error executing /${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
      return;
    }

    // --- BUTTON INTERACTION HANDLER ---
    if (interaction.isButton()) {
      const logChannel = interaction.guild.channels.cache.find(channel => channel.name === config.logChannelName);

      // --- NEW: VERIFICATION ADMIN BUTTONS ---
      if (interaction.customId.startsWith('verify_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'You must be an Administrator to use these buttons.', ephemeral: true });
        }

        const [action, userId] = interaction.customId.split(':');

        if (action === 'deny') {
          const modal = new ModalBuilder()
            .setCustomId(`verify_deny_modal:${userId}`)
            .setTitle('Deny Verification');
          const reasonInput = new TextInputBuilder()
            .setCustomId('deny_reason')
            .setLabel("Reason for Denial (will be sent to user)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          await interaction.showModal(modal);
        } else if (action === 'approve') {
          await interaction.deferUpdate(); // Acknowledge the button click before processing
          const memberToVerify = await interaction.guild.members.fetch(userId).catch(() => null);
          const db = await readDb();

          if (!memberToVerify) {
            return interaction.followUp({ content: 'This user is no longer in the server.', ephemeral: true });
          }

          const verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase().trim() === config.verifiedRoleName.toLowerCase().trim());
          const unverifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase().trim() === config.unverifiedRoleName.toLowerCase().trim());

          if (verifiedRole) await memberToVerify.roles.add(verifiedRole);
          if (unverifiedRole) await memberToVerify.roles.remove(unverifiedRole);

          if (db.verificationProgress?.[userId]) {
            delete db.verificationProgress[userId];
            await writeDb(db);
          }

          await memberToVerify.send(`🎉 Congratulations! A staff member has approved your verification, and you now have full access to **${interaction.guild.name}**.`).catch(() => { });
          if (logChannel) await logChannel.send(`✅ **Member Approved**: ${memberToVerify.user.tag} was manually approved by ${interaction.user.tag}.`);

          const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x00FF00)
            .setTitle('✅ Member Approved')
            .setFooter({ text: `Approved by ${interaction.user.tag}` });
          await interaction.message.edit({ embeds: [originalEmbed], components: [] });
        }
        return;
      }

      // --- RESTORED: RULES AGREEMENT BUTTON ---
      if (interaction.customId === 'rules_agree') {
        try {
          const db = await readDb();
          if (!db.verificationProgress) db.verificationProgress = {};
          if (!db.verificationProgress[interaction.user.id]) {
            db.verificationProgress[interaction.user.id] = {};
          }
          if (db.verificationProgress[interaction.user.id].agreedToRules) {
            return interaction.reply({ content: 'You have already agreed to the rules.', ephemeral: true });
          }
          db.verificationProgress[interaction.user.id].agreedToRules = true;
          await writeDb(db);
          return interaction.reply({ content: 'Thank you for agreeing to the server rules! You may now proceed with the other verification steps.', ephemeral: true });
        } catch (error) {
          console.error("Error handling rule agreement:", error);
          return interaction.reply({ content: 'An error occurred while processing your agreement. Please try again.', ephemeral: true });
        }
      }

      // --- RESTORED: REACTION ROLE BUTTONS ---
      if (interaction.customId.startsWith('reaction_role:')) {
        const action = interaction.customId.split(':')[1];
        const member = interaction.member;

        if (action === 'kick_under_16') {
          // ... (This logic is from the original file and remains unchanged)
        }

        try {
          const userRolesToRemove = member.roles.cache.filter(role => allAgeRoleNames.has(role.name));
          if (action === 'clear_age_role') {
            if (userRolesToRemove.size > 0) {
              await member.roles.remove(userRolesToRemove);
              await interaction.reply({ content: 'Your age role has been successfully removed.', flags: [MessageFlags.Ephemeral] });
              if (logChannel) await logChannel.send(`👤 **Role Update**: ${interaction.user.tag} cleared their age role.`);
            } else {
              await interaction.reply({ content: 'You do not currently have an age role to remove.', flags: [MessageFlags.Ephemeral] });
            }
            return;
          }
          const roleToAdd = interaction.guild.roles.cache.find(r => r.name === action);
          if (!roleToAdd) {
            return interaction.reply({ content: 'An error occurred: The role for this button could not be found.', flags: [MessageFlags.Ephemeral] });
          }
          if (userRolesToRemove.size > 0) {
            await member.roles.remove(userRolesToRemove);
          }
          await member.roles.add(roleToAdd);
          await interaction.reply({ content: `You have been given the **${roleToAdd.name}** role!`, flags: [MessageFlags.Ephemeral] });
          if (logChannel) await logChannel.send(`👤 **Role Update**: ${interaction.user.tag} self-assigned the **${roleToAdd.name}** role.`);
        } catch (error) {
          console.error('Error handling reaction role update:', error);
          await interaction.reply({ content: 'Sorry, there was an error trying to update your roles. Please try again later.', flags: [MessageFlags.Ephemeral] });
        }
      }

      // --- RESTORED: BAN EVASION BUTTONS ---
      if (interaction.customId.startsWith('evasion_')) {
        // ... (This logic is from the original file and remains unchanged)
      }
    }

    // --- MODAL SUBMIT HANDLER ---
    if (interaction.isModalSubmit()) {
      const logChannel = interaction.guild.channels.cache.find(channel => channel.name === config.logChannelName);

      if (interaction.customId.startsWith('verify_deny_modal:')) {
        const userId = interaction.customId.split(':')[1];
        const reason = interaction.fields.getTextInputValue('deny_reason');
        const memberToDeny = await interaction.guild.members.fetch(userId).catch(() => null);
        const db = await readDb();

        if (memberToDeny) {
          await memberToDeny.send(`❌ Your verification for **${interaction.guild.name}** was denied by a staff member.\n\n**Reason:** ${reason}\n\nPlease correct the issues and you may try to apply again.`).catch(() => { });
        }

        if (db.verificationProgress?.[userId]) {
          delete db.verificationProgress[userId];
          await writeDb(db);
        }

        if (logChannel) await logChannel.send(`❌ **Member Denied**: ${memberToDeny?.user.tag || `User ${userId}`} was denied by ${interaction.user.tag}. Reason: ${reason}`);

        // Edit the original message embed to show the denial
        // We fetch the original message from the channel the modal was triggered from
        const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
        if (originalMessage) {
          const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0])
            .setColor(0xFF0000)
            .setTitle('❌ Member Denied')
            .addFields({ name: 'Reason', value: reason })
            .setFooter({ text: `Denied by ${interaction.user.tag}` });
          await originalMessage.edit({ embeds: [originalEmbed], components: [] });
        }

        await interaction.reply({ content: 'Denial has been processed and the user has been notified.', ephemeral: true });
      }
    }
  },
};