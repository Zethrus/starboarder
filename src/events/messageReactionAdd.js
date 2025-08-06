// src/events/messageReactionAdd.js
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const handleStarboard = require('../features/starboard');
const { readDb, writeDb } = require('../utils/helpers');
const { checkVerificationStatus } = require('../features/verification');
const config = require('../../config');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;

    // --- VERIFICATION CHECK HANDLER ---
    try {
      const db = await readDb();
      if (reaction.message.id === db.verificationMessageId && reaction.emoji.name === '✅') {
        const member = await reaction.message.guild.members.fetch(user.id);

        // Remove reaction to indicate processing
        await reaction.users.remove(user.id);
        const thinkingMessage = await reaction.message.reply({
          content: `Thanks, ${user.tag}! I'm checking your application now...`,
          ephemeral: true // This makes the message only visible to the user
        });


        // Check if user is already pending review
        if (db.verificationProgress?.[user.id]?.status === 'pending') {
          await user.send('You have already submitted an application for review. Please be patient while the staff team looks at it.').catch(() => { });
          return;
        }

        const status = await checkVerificationStatus(member);

        if (status.success) {
          // All checks passed, notify admins
          const adminChannel = reaction.message.guild.channels.cache.find(c => c.name === config.banEvasionAlertChannelName);
          if (!adminChannel) {
            console.error(`[Verification] Admin channel #${config.banEvasionAlertChannelName} not found!`);
            return;
          }

          const evidenceEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('✅ New Member Verification Request')
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setDescription(`${user} has completed all verification steps and is ready for manual review.`)
            .addFields(
              { name: 'User', value: `${user} (${user.id})` },
              { name: 'Intro Post', value: `[Click to View](${status.evidence.introMessage.url})` },
              { name: 'Photo Submission(s)', value: status.evidence.photoMessages.map(msg => `[View Post](${msg.url})`).join('\n') || 'No photo posts found.' }
            )
            .setTimestamp();

          const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`verify_approve:${user.id}`)
              .setLabel('Approve')
              .setStyle(ButtonStyle.Success)
              .setEmoji('👍'),
            new ButtonBuilder()
              .setCustomId(`verify_deny:${user.id}`)
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('👎'),
            new ButtonBuilder()
              .setLabel('View Profile')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/users/${user.id}`)
          );

          await adminChannel.send({
            content: `@here, a new member is awaiting verification.`, // You can change @here to a specific role ping if you have one
            embeds: [evidenceEmbed],
            components: [actionRow]
          });

          // Mark user as pending and DM them
          db.verificationProgress[user.id].status = 'pending';
          await writeDb(db);
          await user.send('Your application has been successfully submitted for staff review! You will be notified of the outcome.').catch(() => { });

        } else {
          // Checks failed, DM the user the missing steps
          const failureMessage = `❌ **Verification Incomplete**\n\nWe noticed you tried to complete the verification process, but you are still missing the following step(s):\n\n- ${status.missing.join('\n- ')}\n\nPlease complete these steps and then react to the message in #how-2-member again.`;
          await user.send(failureMessage).catch(() => { });
        }
        await thinkingMessage.delete();
      }
    } catch (error) {
      console.error("Error processing verification reaction:", error);
    }

    // --- STARBOARD FEATURE ---
    await handleStarboard(reaction, user);
  },
};