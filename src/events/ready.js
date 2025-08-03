// src/events/ready.js
const { Events } = require('discord.js');
const config = require('../../config');

// Helper function to format emoji for display
function formatEmoji(emoji) {
  if (!emoji) return '⭐'; // Default emoji
  if (emoji.isCustom) {
    return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  }
  return emoji.name;
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Configuration:`);
    console.log(`- Starboard Channel: #${config.starboardChannel}`);
    console.log(`- Required Stars: ${config.requiredStars}`);
    console.log(`- Star Emoji: ${formatEmoji(config.starEmoji)}`);
    console.log(`- Photography Channel: #${config.photographyChannel}`);
    console.log(`- Theme Channel: #${config.themeChannel}`);
    console.log(`- Theme Hashtag: ${config.themeHashtag}`);

    // Get server information
    const guilds = client.guilds.cache;
    const guildCount = guilds.size;
    let totalUsers = 0;
    const guildInfo = [];

    guilds.forEach(guild => {
      const memberCount = guild.memberCount;
      totalUsers += memberCount;
      guildInfo.push(`  - ${guild.name} (${memberCount} users)`);
    });

    console.log(`\nConnected to ${guildCount} server${guildCount !== 1 ? 's' : ''} with a total of ${totalUsers.toLocaleString()} users:`);
    console.log(guildInfo.join('\n'));
  },
};
