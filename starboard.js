const { Client, GatewayIntentBits, EmbedBuilder, Partials, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Reaction]
});

// Load configuration from .env with defaults
const STARBOARD_CHANNEL = process.env.STARBOARD_CHANNEL || 'starboard';
const REQUIRED_STARS = parseInt(process.env.REQUIRED_STARS) || 5;
const STAR_EMOJI = process.env.STAR_EMOJI || '⭐';

// Parse the configured emoji
function parseEmoji(emojiStr) {
  // Check if it's a custom emoji (format: <:name:id> or <a:name:id>)
  const customMatch = emojiStr.match(/^<?(a)?:([^\s]+):(\d+)>?$/);

  if (customMatch) {
    return {
      isCustom: true,
      animated: customMatch[1] === 'a',
      name: customMatch[2],
      id: customMatch[3]
    };
  }

  // Otherwise treat as unicode emoji
  return {
    isCustom: false,
    name: emojiStr
  };
}

const parsedEmoji = parseEmoji(STAR_EMOJI);

// Function to format emoji for display
function formatEmoji(emoji) {
  if (emoji.isCustom) {
    return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  }
  return emoji.name;
}

// Store starred message IDs to prevent duplicates
const starredMessages = new Set();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Configuration:`);
  console.log(`- Starboard Channel: #${STARBOARD_CHANNEL}`);
  console.log(`- Required Stars: ${REQUIRED_STARS}`);
  console.log(`- Star Emoji: ${formatEmoji(parsedEmoji)}`);

  // Get server information
  const guilds = client.guilds.cache;
  const guildCount = guilds.size;

  // Calculate total users across all servers
  let totalUsers = 0;
  const guildInfo = [];

  guilds.forEach(guild => {
    const memberCount = guild.memberCount;
    totalUsers += memberCount;
    guildInfo.push(`  - ${guild.name} (${memberCount} users)`);
  });

  // Log server information
  console.log(`\nConnected to ${guildCount} server${guildCount !== 1 ? 's' : ''} with a total of ${totalUsers.toLocaleString()} users:`);
  console.log(guildInfo.join('\n'));

  // Log additional bot information
  console.log(`\nBot is in ${guildCount} server${guildCount !== 1 ? 's' : ''}`);
  console.log(`Bot can see ${totalUsers.toLocaleString()} total users`);
  console.log(`Bot prefix: ! (for commands) and ${formatEmoji(parsedEmoji)} (for starring messages)`);
});

// Handle message reactions for starboard
client.on('messageReactionAdd', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;

  // Check if reaction matches our configured emoji
  const isMatch = parsedEmoji.isCustom
    ? reaction.emoji.id === parsedEmoji.id && reaction.emoji.name === parsedEmoji.name
    : reaction.emoji.name === parsedEmoji.name;

  if (!isMatch) return;

  // Fetch the full message if it's a partial
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      console.error('Error fetching message:', error);
      return;
    }
  }

  const message = reaction.message;

  // Skip if already starred
  if (starredMessages.has(message.id)) return;

  // Get star count (including current reaction)
  const starCount = reaction.count;

  // Check if message has enough stars
  if (starCount < REQUIRED_STARS) return;

  // Check if message has image
  const image = getImageFromMessage(message);
  if (!image) return;

  // Find starboard channel
  const starboardChannel = message.guild.channels.cache.find(
    channel => channel.name === STARBOARD_CHANNEL && channel.isTextBased()
  );

  if (!starboardChannel) {
    console.error(`Starboard channel #${STARBOARD_CHANNEL} not found in server: ${message.guild.name}`);
    return;
  }

  // Create starboard embed
  const embed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold color
    .setTitle(`${formatEmoji(parsedEmoji)} Starred Message`)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true, size: 256 }),
      url: `https://discord.com/users/${message.author.id}`
    })
    .setDescription(message.content || 'No content provided')
    .setImage(image)
    .addFields(
      {
        name: 'Original Message',
        value: `[Jump to message](${message.url})`
      },
      {
        name: 'Stars',
        value: `${starCount} ${formatEmoji(parsedEmoji)}`,
        inline: true
      },
      {
        name: 'Channel',
        value: `${message.channel}`,
        inline: true
      }
    )
    .setTimestamp()
    .setFooter({
      text: `Message ID: ${message.id} | Author ID: ${message.author.id}`
    });

  // Post to starboard
  try {
    await starboardChannel.send({ embeds: [embed] });
    starredMessages.add(message.id);
    console.log(`Message ${message.id} posted to starboard in server: ${message.guild.name}`);
  } catch (error) {
    console.error(`Error posting to starboard in server ${message.guild.name}:`, error);
  }
});

// Handle the move command
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if the message starts with the move command
  if (message.content.startsWith('!move')) {
    // Check if user has either Administrator or Manage Messages permission
    const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasManageMessages = message.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!hasAdmin && !hasManageMessages) {
      return message.reply('You need either the "Administrator" or "Manage Messages" permission to use this command.');
    }

    // Parse command arguments
    const args = message.content.slice(5).trim().split(/ +/);
    const targetChannelName = args[0];

    if (!targetChannelName) {
      return message.reply('Please specify a target channel. Usage: `!move <target_channel> [message_id] [reason]`');
    }

    // Find the target channel
    const targetChannel = message.guild.channels.cache.find(
      channel => channel.name === targetChannelName && channel.isTextBased()
    );

    if (!targetChannel) {
      return message.reply(`Could not find a channel named "${targetChannelName}".`);
    }

    // Check if bot has permission to send messages in the target channel
    if (!targetChannel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
      return message.reply(`I don't have permission to send messages in #${targetChannelName}.`);
    }

    // Get the message to move
    let messageToMove;
    let messageId = null;
    let reason = '';

    // Check if second argument is a message ID (17-19 digit number)
    if (args.length > 1 && /^\d{17,19}$/.test(args[1])) {
      messageId = args[1];
      reason = args.slice(2).join(' ');

      // Try to fetch by ID
      try {
        messageToMove = await message.channel.messages.fetch(messageId);
      } catch (error) {
        return message.reply('Could not find a message with that ID in this channel.');
      }
    } else {
      // No message ID provided, get the last message with an attachment
      reason = args.slice(1).join(' ');

      const messages = await message.channel.messages.fetch({ limit: 10 });
      messageToMove = messages.find(msg =>
        msg.attachments.size > 0 &&
        msg.attachments.some(att =>
          att.contentType && (att.contentType.startsWith('image/') || att.contentType.startsWith('video/'))
        )
      );

      if (!messageToMove) {
        return message.reply('Could not find any recent message with an image or video in this channel.');
      }
    }

    // Check if the message has an image or video attachment
    const attachment = messageToMove.attachments.find(att =>
      att.contentType && (att.contentType.startsWith('image/') || att.contentType.startsWith('video/'))
    );

    if (!attachment) {
      return message.reply('The specified message does not contain an image or video attachment.');
    }

    try {
      // Create embed for the reposted message
      const embed = new EmbedBuilder()
        .setColor(0x00AE86) // Green color
        .setTitle('Moved Content')
        .setAuthor({
          name: messageToMove.author.tag,
          iconURL: messageToMove.author.displayAvatarURL({ dynamic: true, size: 256 }),
          url: `https://discord.com/users/${messageToMove.author.id}`
        })
        .setDescription(messageToMove.content || 'No content provided')
        .addFields(
          {
            name: 'Originally Posted In',
            value: `${messageToMove.channel}`
          },
          {
            name: 'Moved By',
            value: `${message.author.tag}`
          }
        );

      // Add reason field if provided
      if (reason) {
        embed.addFields({
          name: 'Reason',
          value: reason
        });
      }

      embed.setTimestamp()
        .setFooter({
          text: `Original Message ID: ${messageToMove.id}`
        });

      // Send the attachment and embed to the target channel
      await targetChannel.send({
        content: `**Moved from ${messageToMove.channel}:**`,
        embeds: [embed],
        files: [attachment]
      });

      // Delete the original message
      await messageToMove.delete();

      // Confirm the move
      let confirmationMessage = `Successfully moved the message to #${targetChannelName}.`;
      if (reason) {
        confirmationMessage += `\nReason: ${reason}`;
      }
      await message.reply(confirmationMessage);
    } catch (error) {
      console.error('Error moving message:', error);
      await message.reply('There was an error moving the message. Please check my permissions and try again.');
    }
  }
});

// Helper function to get image URL from message
function getImageFromMessage(message) {
  // Check attachments first
  const attachment = message.attachments.find(att =>
    att.contentType && att.contentType.startsWith('image/')
  );
  if (attachment) return attachment.url;

  // Check embeds
  const embedImage = message.embeds.find(embed => embed.image);
  if (embedImage) return embedImage.image.url;

  // Check embed thumbnails
  const embedThumbnail = message.embeds.find(embed => embed.thumbnail);
  if (embedThumbnail) return embedThumbnail.thumbnail.url;

  return null;
}

client.login(process.env.DISCORD_TOKEN);