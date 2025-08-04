// src/commands/move.js
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { replyThenDelete } = require('../utils/helpers');

module.exports = {
  name: 'move',
  description: 'Moves a message with an image/video to another channel.',
  async execute(message, args) {
    // Check if user has either Administrator or Manage Messages permission
    const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasManageMessages = message.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!hasAdmin && !hasManageMessages) {
      return replyThenDelete(message, 'You need either the "Administrator" or "Manage Messages" permission to use this command.');
    }

    // Check if we have at least 2 arguments (target channel and message ID)
    if (args.length < 2) {
      return replyThenDelete(message, 'Please specify a target channel and message ID. Usage: `!move <#channel-name or channel-name> <message_id> [reason]`');
    }

    const targetChannelArg = args[0];
    const messageId = args[1];
    const reason = args.slice(2).join(' ').trim();

    // Find the target channel by mention or by name
    const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.find(
      channel => channel.name === targetChannelArg && channel.isTextBased()
    );

    if (!targetChannel) {
      return replyThenDelete(message, `Could not find a text channel named "${targetChannelArg}".`);
    }

    // Validate message ID format
    if (!/^\d{17,19}$/.test(messageId)) {
      return replyThenDelete(message, 'Invalid message ID format. Please use a valid message ID.');
    }

    // Check if bot has permission to send messages in the target channel
    if (!targetChannel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
      return replyThenDelete(message, `I don't have permission to send messages in ${targetChannel}.`);
    }

    // Try to fetch the message by ID from the current channel
    let messageToMove;
    try {
      messageToMove = await message.channel.messages.fetch(messageId);
    } catch (error) {
      return replyThenDelete(message, 'Could not find a message with that ID in this channel.');
    }

    // Check if the message has an image or video attachment
    const attachment = messageToMove.attachments.find(att =>
      att.contentType && (att.contentType.startsWith('image/') || att.contentType.startsWith('video/'))
    );

    if (!attachment) {
      return replyThenDelete(message, 'The specified message does not contain an image or video attachment.');
    }

    try {
      // Create embed for the reposted message
      const embed = new EmbedBuilder()
        .setColor(0x00AE86) // Green color
        .setTitle('Content Moved')
        .setAuthor({
          name: messageToMove.author.tag,
          iconURL: messageToMove.author.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(messageToMove.content || '_No original text content._')
        .addFields(
          { name: 'Originally Posted In', value: `${messageToMove.channel}`, inline: true },
          { name: 'Moved By', value: `${message.author.tag}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Original Message ID: ${messageToMove.id}` });

      if (reason) {
        embed.addFields({ name: 'Reason', value: reason });
      }

      // Send the attachment and embed to the target channel
      await targetChannel.send({
        content: `**Content moved from ${messageToMove.channel}:**`,
        embeds: [embed],
        files: [attachment]
      });

      // Delete the original message
      await messageToMove.delete();

      // Confirm the move in the original channel and delete the confirmation
      await replyThenDelete(message, `Successfully moved the message to ${targetChannel}.`, 10000);
      // Also delete the command message `!move ...`
      await message.delete().catch(console.error);

    } catch (error) {
      console.error('Error moving message:', error);
      await replyThenDelete(message, 'There was an error moving the message. Please check my permissions and try again.');
    }
  },
};
