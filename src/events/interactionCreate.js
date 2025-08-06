// src/events/interactionCreate.js
const { Events, MessageFlags, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ROLE_BUTTON_CONFIG } = require('../commands/setup-reactions.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

const allAgeRoleNames = new Set(
  ROLE_BUTTON_CONFIG.filter(config => config.roleName !== 'clear_age_role' && config.roleName !== 'kick_under_16')
    .map(config => config.roleName)
);

// --- HELPER FUNCTION FOR DENIAL LOGIC ---
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

  // Find the original message to edit. This assumes the button that triggered this was on the original message.
  const originalMessage = interaction.message;
  const approvalEmbed = originalMessage.embeds[0];

  if (approvalEmbed) {
    const deniedEmbed = EmbedBuilder.from(approvalEmbed)
      .setColor(0xFF0000)
      .setTitle('❌ Member Denied')
      .addFields({ name: 'Reason', value: reason })
      .setFooter({ text: `Denied by ${interaction.user.tag}` });
    // We find the original message via the interaction that triggered the denial buttons
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

      // A general permission check for all admin-level buttons
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
            new ButtonBuilder().setCustomId(`deny_reason_intro:${userId}`).setLabel('Intro Too Short').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`deny_reason_photos:${userId}`).setLabel('Not Enough Photos').setStyle(ButtonStyle.Secondary),
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

        // This is a special case where the ephemeral reply that holds the buttons is updated.
        const originalInteractionMessage = interaction.message;

        if (reasonType === 'other') {
          const modal = new ModalBuilder().setCustomId(`verify_deny_modal:${userId}:${originalInteractionMessage.id}`).setTitle('Deny Verification');
          const reasonInput = new TextInputBuilder().setCustomId('deny_reason').setLabel("Reason for Denial").setStyle(TextInputStyle.Paragraph).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          await interaction.showModal(modal);
        } else {
          await interaction.update({ content: 'Processing denial...', components: [] });
          let reason = 'No reason specified.';
          if (reasonType === 'intro') reason = 'Your introduction in #intros did not meet the minimum length or quality requirement.';
          if (reasonType === 'photos') reason = 'You did not post the required minimum of 3 photos in #photography.';

          await handleDenial(interaction, userId, reason);
        }
        return;
      }

      // --- RULES AGREEMENT BUTTON ---
      if (interaction.customId === 'rules_agree') {
        // ... (This logic is from the previous file and remains unchanged)
      }

      // --- REACTION ROLE BUTTONS ---
      if (interaction.customId.startsWith('reaction_role:')) {
        // ... (This logic is from the previous file and remains unchanged)
      }

      // --- BAN EVASION BUTTONS ---
      if (interaction.customId.startsWith('evasion_')) {
        // ... (This logic is from the previous file and remains unchanged)
      }
    }

    // --- MODAL SUBMIT HANDLER ---
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('verify_deny_modal:')) {
        const [, , userId, originalMessageId] = interaction.customId.split(':');
        const reason = interaction.fields.getTextInputValue('deny_reason');

        // We need to fetch the original admin-chat message to edit it.
        const adminChannel = interaction.channel;
        const originalMessage = await adminChannel.messages.fetch(originalMessageId).catch(() => null);

        // Create a temporary interaction-like object for the helper function
        const denialInteraction = { guild: interaction.guild, channel: adminChannel, message: originalMessage, user: interaction.user };

        await handleDenial(denialInteraction, userId, reason);
        await interaction.reply({ content: 'Custom denial has been processed.', ephemeral: true });
      }
    }
  },
};