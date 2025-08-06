// src/events/interactionCreate.js
const { Events, MessageFlags, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ROLE_BUTTON_CONFIG } = require('../commands/setup-reactions.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

const allAgeRoleNames = new Set(
  ROLE_BUTTON_CONFIG.filter(config => config.roleName !== 'clear_age_role' && config.roleName !== 'kick_under_16')
    .map(config => config.roleName)
);

// --- HELPER FUNCTION FOR DENIAL LOGIC (This is the refactored code) ---
async function handleDenial(interaction, userId, reason) {
  const logChannel = interaction.guild.channels.cache.find(channel => channel.name === config.logChannelName);
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

  // The original approval request message is the one the button was attached to.
  const originalMessage = interaction.message;
  if (originalMessage && originalMessage.embeds.length > 0) {
    const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0])
      .setColor(0xFF0000)
      .setTitle('❌ Member Denied')
      .setFields( // Using setFields to replace old fields and add the new one
        { name: 'User', value: originalMessage.embeds[0].fields[0].value },
        { name: 'Intro Post', value: originalMessage.embeds[0].fields[1].value },
        { name: 'Photo Submission(s)', value: originalMessage.embeds[0].fields[2].value },
        { name: 'Reason', value: reason }
      )
      .setFooter({ text: `Denied by ${interaction.user.tag}` });
    await originalMessage.edit({ embeds: [deniedEmbed], components: [] });
  }
}


module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // --- SLASH COMMAND HANDLER ---
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
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

      if (interaction.customId.startsWith('verify_') || interaction.customId.startsWith('deny_reason_') || interaction.customId.startsWith('evasion_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'You must be an Administrator to use these buttons.', ephemeral: true });
        }
      }

      // --- VERIFICATION ADMIN BUTTONS (Approve/Deny) ---
      if (interaction.customId.startsWith('verify_')) {
        const [action, userId] = interaction.customId.split(':');

        if (action === 'approve') {
          await interaction.deferUpdate();
          const memberToVerify = await interaction.guild.members.fetch(userId).catch(() => null);
          if (!memberToVerify) return;

          const db = await readDb();
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

        } else if (action === 'deny') {
          const reasonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`deny_reason_intro:${userId}`).setLabel('Intro/Photos').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`deny_reason_rules:${userId}`).setLabel('Rule Violation').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`deny_reason_other:${userId}`).setLabel('Other (Specify)').setStyle(ButtonStyle.Danger)
          );
          await interaction.reply({
            content: 'Please select a reason for the denial:',
            components: [reasonRow],
            ephemeral: true
          });
        }
        return;
      }

      // --- PRE-DEFINED DENIAL REASON BUTTONS ---
      if (interaction.customId.startsWith('deny_reason_')) {
        const [, , reasonType, userId] = interaction.customId.split(':');

        if (reasonType === 'other') {
          const modal = new ModalBuilder().setCustomId(`verify_deny_modal:${userId}`).setTitle('Deny Verification');
          const reasonInput = new TextInputBuilder().setCustomId('deny_reason').setLabel("Custom reason for denial").setStyle(TextInputStyle.Paragraph).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          await interaction.showModal(modal);
        } else {
          await interaction.update({ content: 'Processing denial...', components: [] });
          let reason = 'No reason specified.';
          if (reasonType === 'intro') reason = 'Your introduction or photos did not meet the quality requirements.';
          if (reasonType === 'rules') reason = 'Your submission or profile violates server rules.';

          await handleDenial(interaction, userId, reason);
        }
        return;
      }

      // --- FULL CODE: RULES AGREEMENT BUTTON ---
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

      // --- FULL CODE: REACTION ROLE BUTTONS ---
      if (interaction.customId.startsWith('reaction_role:')) {
        const action = interaction.customId.split(':')[1];
        const member = interaction.member;

        if (action === 'kick_under_16') {
          // Kick logic remains here
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

      // --- FULL CODE: BAN EVASION BUTTONS ---
      if (interaction.customId.startsWith('evasion_')) {
        const [action, targetId] = interaction.customId.split(':');

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

    // --- MODAL SUBMIT HANDLER ---
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('verify_deny_modal:')) {
        const userId = interaction.customId.split(':')[1];
        const reason = interaction.fields.getTextInputValue('deny_reason');
        await handleDenial(interaction, userId, reason);
        await interaction.reply({ content: 'Custom denial has been processed.', ephemeral: true });
      }
    }
  },
};