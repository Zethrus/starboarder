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
  // --- Settings for Ban Evasion Detection ---
  enableBanEvasion: (process.env.ENABLE_BAN_EVASION || 'true').toLowerCase() === 'true',
  banEvasionMaxAccountAgeDays: parseInt(process.env.BAN_EVASION_MAX_ACCOUNT_AGE_DAYS, 10) || 1, // Default to 1 day
  banEvasionAction: process.env.BAN_EVASION_ACTION || 'log', // Can be 'log' or 'ban'
  banEvasionAlertChannelName: process.env.BAN_EVASION_ALERT_CHANNEL_NAME || 'admin-chat',
  // --- Settings for Alt Account Detection ---
  altAccountThresholdHours: parseInt(process.env.ALT_ACCOUNT_THRESHOLD_HOURS, 10) || 24, // Time window in hours to check for similar creation dates


  // --- Settings for Unverified Member Reminder ---
  verifiedRoleName: process.env.VERIFIED_ROLE_NAME || 'Verified Member',
  unverifiedRoleName: process.env.UNVERIFIED_ROLE_NAME || 'Unverified Member',
  verificationReminderDelayDays: parseInt(process.env.VERIFICATION_REMINDER_DELAY_DAYS, 10) || 3,
  verificationReminderMessage: `Hi there, we noticed that you have not yet successfully gone through the process for "Verified Member" for full access in the Urbex Alberta Discord server. 
We would strongly recommend that you thoroughly read the post in #how-2-member to proceed further, as unverified accounts are routinely purged within` + process.env.PURGE_DELAY_DAYS + ` days.

We look forward to seeing your explorations and adventures~
The Urbex Alberta Team`,

  // --- Settings for Auto-Purge ---
  enableAutoPurge: (process.env.ENABLE_AUTO_PURGE || 'false').toLowerCase() === 'false',
  purgeDelayDays: parseInt(process.env.PURGE_DELAY_DAYS, 10) || 7,
  purgeGracePeriodDays: parseInt(process.env.PURGE_GRACE_PERIOD_DAYS, 10) || 1,

  // --- Logging & Safety ---
  logChannelName: process.env.LOG_CHANNEL_NAME || 'logs',
  enableDryRun: (process.env.ENABLE_DRY_RUN || 'true').toLowerCase() === 'true',
};