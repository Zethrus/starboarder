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

// New configuration for theme-of-the-month feature
const PHOTOGRAPHY_CHANNEL = process.env.PHOTOGRAPHY_CHANNEL || 'photography';
const THEME_CHANNEL = process.env.THEME_CHANNEL || 'theme-of-the-month-submissions';
const THEME_HASHTAG = process.env.THEME_HASHTAG ? process.env.THEME_HASHTAG.trim() : '#theme-of-the-month';
console.log(`Theme hashtag set to: "${THEME_HASHTAG}"`);

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

// Store theme submission IDs to prevent duplicates
const themeSubmissions = new Set();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Configuration:`);
  console.log(`- Starboard Channel: #${STARBOARD_CHANNEL}`);
  console.log(`- Required Stars: ${REQUIRED_STARS}`);
  console.log(`- Star Emoji: ${formatEmoji(parsedEmoji)}`);
  console.log(`- Photography Channel: #${PHOTOGRAPHY_CHANNEL}`);
  console.log(`- Theme Channel: #${THEME_CHANNEL}`);
  console.log(`- Theme Hashtag: ${THEME_HASHTAG}`);

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

// Handle theme-of-the-month submissions
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Debug: Log all messages in photography channel
  if (message.channel.name === PHOTOGRAPHY_CHANNEL) {
    console.log(`Message in photography channel: "${message.content}"`);
    console.log(`Attachments: ${message.attachments.size}`);
    console.log(`Embeds: ${message.embeds.length}`);

    // Log attachment details
    message.attachments.forEach(att => {
      console.log(`Attachment: ${att.name}, Content-Type: ${att.contentType}`);
    });

    // Log channel mentions
    console.log(`Channel mentions: ${message.mentions.channels.size}`);
    message.mentions.channels.forEach(channel => {
      console.log(`Mentioned channel: #${channel.name} (${channel.id})`);
    });
  }

  // Check if message is in the photography channel
  if (message.channel.name !== PHOTOGRAPHY_CHANNEL) return;

  // More robust hashtag detection - check message content, embeds, attachment names, and channel mentions
  let hashtagFound = false;

  // Check in message content
  const hashtagRegex = new RegExp(`\\b${THEME_HASHTAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  if (hashtagRegex.test(message.content)) {
    hashtagFound = true;
    console.log('Hashtag found in message content');
  }

  // Check in embeds (for images posted with URLs)
  if (!hashtagFound && message.embeds.length > 0) {
    for (const embed of message.embeds) {
      if (embed.description && hashtagRegex.test(embed.description)) {
        hashtagFound = true;
        console.log('Hashtag found in embed description');
        break;
      }
      if (embed.title && hashtagRegex.test(embed.title)) {
        hashtagFound = true;
        console.log('Hashtag found in embed title');
        break;
      }
    }
  }

  // Check in attachment names/comments
  if (!hashtagFound && message.attachments.size > 0) {
    for (const attachment of message.attachments) {
      if (attachment.name && hashtagRegex.test(attachment.name)) {
        hashtagFound = true;
        console.log('Hashtag found in attachment name');
        break;
      }
      // Some Discord clients put the hashtag in the attachment comment
      if (attachment.description && hashtagRegex.test(attachment.description)) {
        hashtagFound = true;
        console.log('Hashtag found in attachment description');
        break;
      }
    }
  }

  // Check channel mentions (this is the key fix)
  if (!hashtagFound && message.mentions.channels.size > 0) {
    for (const channel of message.mentions.channels.values()) {
      // Check if the mentioned channel name matches our hashtag (without the #)
      const channelNameWithoutHash = THEME_HASHTAG.substring(1); // Remove the #
      if (channel.name === channelNameWithoutHash) {
        hashtagFound = true;
        console.log(`Hashtag found as channel mention: #${channel.name}`);
        break;
      }
    }
  }

  if (!hashtagFound) {
    console.log('Hashtag not found in message, embeds, attachments, or channel mentions');
    return;
  }

  // Skip if already submitted
  if (themeSubmissions.has(message.id)) {
    console.log('Message already submitted');
    return;
  }

  // Count all image attachments
  const imageAttachments = message.attachments.filter(att =>
    att.contentType && att.contentType.startsWith('image/')
  );

  // Count images in embeds
  let embedImageCount = 0;
  message.embeds.forEach(embed => {
    if (embed.image) embedImageCount++;
    if (embed.thumbnail) embedImageCount++;
  });

  // Total image count
  const totalImageCount = imageAttachments.size + embedImageCount;
  console.log(`Total images found: ${totalImageCount} (${imageAttachments.size} attachments, ${embedImageCount} in embeds)`);

  // Check if there's exactly one image
  if (totalImageCount === 0) {
    console.log('No image found in message');
    // Notify the user that their submission needs an image
    return message.reply(`Your submission for ${THEME_HASHTAG} must include an image. Please try again.`);
  } else if (totalImageCount > 1) {
    console.log('Multiple images found, denying submission');
    // Notify the user that only single images are allowed
    return message.reply(`Your submission for ${THEME_HASHTAG} must include only a single image to be a valid entry. Please try again.`);
  }

  // Get the image URL
  let image = null;

  // Check attachments first
  if (imageAttachments.size > 0) {
    image = imageAttachments.first().url;
    console.log('Using image from attachment');
  }

  // Check embeds if no attachment image found
  if (!image && message.embeds.length > 0) {
    const embedImage = message.embeds.find(embed => embed.image);
    if (embedImage) {
      image = embedImage.image.url;
      console.log('Using image from embed');
    }
  }

  // Check embed thumbnails if no other image found
  if (!image && message.embeds.length > 0) {
    const embedThumbnail = message.embeds.find(embed => embed.thumbnail);
    if (embedThumbnail) {
      image = embedThumbnail.thumbnail.url;
      console.log('Using image from embed thumbnail');
    }
  }

  console.log('Image found, proceeding with submission');

  // Find theme channel
  const themeChannel = message.guild.channels.cache.find(
    channel => channel.name === THEME_CHANNEL && channel.isTextBased()
  );

  if (!themeChannel) {
    console.error(`Theme channel #${THEME_CHANNEL} not found in server: ${message.guild.name}`);
    return;
  }

  console.log(`Theme channel found: #${THEME_CHANNEL}`);

  // Get message content for description (remove hashtag/channel mention if present)
  let description = message.content || '';

  // Remove channel mentions that match our hashtag
  const channelNameWithoutHash = THEME_HASHTAG.substring(1); // Remove the #
  const channelMentionRegex = new RegExp(`<#${message.mentions.channels.find(c => c.name === channelNameWithoutHash)?.id}>`, 'g');
  description = description.replace(channelMentionRegex, '').trim();

  // Remove hashtag if present
  if (hashtagRegex.test(description)) {
    description = description.replace(hashtagRegex, '').trim();
  }

  // Create theme submission embed
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6) // Purple color
    .setTitle(`${THEME_HASHTAG} Submission`)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true, size: 256 }),
      url: `https://discord.com/users/${message.author.id}`
    })
    .setDescription(description || 'No description provided')
    .setImage(image)
    .addFields(
      {
        name: 'Original Message',
        value: `[Jump to message](${message.url})`
      },
      {
        name: 'Submitted In',
        value: `${message.channel}`,
        inline: true
      }
    )
    .setTimestamp()
    .setFooter({
      text: `Message ID: ${message.id} | Author ID: ${message.author.id}`
    });

  // Post to theme channel
  try {
    await themeChannel.send({ embeds: [embed] });
    themeSubmissions.add(message.id);
    console.log(`Message ${message.id} submitted to theme channel in server: ${message.guild.name}`);

    // Notify the user that their submission was successful
    message.reply(`Your submission for ${THEME_HASHTAG} has been posted in #${THEME_CHANNEL}!`);
  } catch (error) {
    console.error(`Error posting to theme channel in server ${message.guild.name}:`, error);
    message.reply(`There was an error submitting your post to #${THEME_CHANNEL}. Please try again later.`);
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

    // Check if we have at least 2 arguments (target channel and message ID)
    if (args.length < 2) {
      return message.reply('Please specify a target channel and message ID. Usage: `!move <target_channel> <message_id> [reason]`');
    }

    const targetChannelName = args[0];
    const messageId = args[1];
    const reason = args.slice(2).join(' ').trim();

    // Validate message ID format (17-19 digit number)
    if (!/^\d{17,19}$/.test(messageId)) {
      return message.reply('Invalid message ID format. Please use a valid message ID.');
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

    // Try to fetch the message by ID
    let messageToMove;
    try {
      messageToMove = await message.channel.messages.fetch(messageId);
    } catch (error) {
      return message.reply('Could not find a message with that ID in this channel.');
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