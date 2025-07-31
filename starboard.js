const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
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
const STAR_EMOJI = '⭐';
const REQUIRED_STARS = parseInt(process.env.REQUIRED_STARS) || 5;

// Store starred message IDs to prevent duplicates
const starredMessages = new Set();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Configuration:`);
  console.log(`- Starboard Channel: #${STARBOARD_CHANNEL}`);
  console.log(`- Required Stars: ${REQUIRED_STARS}`);
});

client.on('messageReactionAdd', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;

  // Only process star reactions
  if (reaction.emoji.name !== STAR_EMOJI) return;

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
    console.error(`Starboard channel #${STARBOARD_CHANNEL} not found`);
    return;
  }

  // Create starboard embed
  const embed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold color
    .setTitle('⭐ Starred Message')
    .setAuthor({
      name: message.author.tag, // Full username#discriminator
      iconURL: message.author.displayAvatarURL({ dynamic: true, size: 256 }),
      url: `https://discord.com/users/${message.author.id}` // Link to user profile
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
        value: `${starCount} ${STAR_EMOJI}`,
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
    console.log(`Message ${message.id} posted to starboard`);
  } catch (error) {
    console.error('Error posting to starboard:', error);
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