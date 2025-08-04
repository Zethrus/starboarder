// config.js
require('dotenv').config();

// Helper function to parse emoji from the .env file
function parseEmoji(emojiStr) {
  if (!emojiStr) return null;
  const customMatch = emojiStr.match(/^<?(a)?:([^\s]+):(\d+)>?$/);

  if (customMatch) {
    return {
      isCustom: true,
      animated: customMatch[1] === 'a',
      name: customMatch[2],
      id: customMatch[3]
    };
  }
  return { isCustom: false, name: emojiStr };
}

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  starboardChannel: process.env.STARBOARD_CHANNEL || 'starboard',
  requiredStars: parseInt(process.env.REQUIRED_STARS, 10) || 5,
  starEmoji: parseEmoji(process.env.STAR_EMOJI || '⭐'),
  photographyChannel: process.env.PHOTOGRAPHY_CHANNEL || 'photography',
  themeChannel: process.env.THEME_CHANNEL || 'theme-of-the-month-submissions',
  themeHashtag: process.env.THEME_HASHTAG ? process.env.THEME_HASHTAG.trim() : '#theme-of-the-month',
  reactionRoleChannel: process.env.REACTION_ROLE_CHANNEL || 'information',
  replyDeleteDelay: parseInt(process.env.REPLY_DELETE_DELAY, 10) || 5000,
};