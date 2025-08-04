// src/commands/move.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { replyThenDelete } = require('../utils/helpers'); // replyThenDelete is not ideal for slash commands, we'll adapt

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Moves a message with an image/video to another channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(option =>
      option.setName('destination')
        .setDescription('The channel to move the message to.')
        .addChannelTypes(ChannelType.GuildText) // Ensure it's a text channel
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message_id')
        .setDescription('The ID of the message to move.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for moving the message.')
        .setRequired(false)),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('destination');
    const messageId = interaction.options.getString('message_id');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    if (!/^\d{17,19}$/.test(messageId)) {
      return interaction.reply({ content: 'Invalid message ID format. Please use a valid message ID.', ephemeral: true });
    }

    let messageToMove;
    try {
      // Assume the command is run in the channel of the message to be moved
      messageToMove = await interaction.channel.messages.fetch(messageId);
    } catch (error) {
      return interaction.reply({ content: 'Could not find a message with that ID in this channel.', ephemeral: true });
    }

    const attachment = messageToMove.attachments.find(att =>
      att.contentType?.startsWith('image/') || att.contentType?.startsWith('video/')
    );

    if (!attachment) {
      return interaction.reply({ content: 'The specified message does not contain an image or video attachment.', ephemeral: true });
    }

    try {
      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('Content Moved')
        .setAuthor({ name: messageToMove.author.tag, iconURL: messageToMove.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(messageToMove.content || '_No original text content._')
        .addFields(
          { name: 'Originally Posted In', value: `${messageToMove.channel}`, inline: true },
          { name: 'Moved By', value: `${interaction.user.tag}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp()
        .setFooter({ text: `Original Message ID: ${messageToMove.id}` });

      await targetChannel.send({
        content: `**Content moved from ${messageToMove.channel}:**`,
        embeds: [embed],
        files: [attachment]
      });

      await messageToMove.delete();

      await interaction.reply({ content: `Successfully moved the message to ${targetChannel}.`, ephemeral: true });

    } catch (error) {
      console.error('Error moving message:', error);
      await interaction.reply({ content: 'There was an error moving the message. Please check my permissions and try again.', ephemeral: true });
    }
  },
};