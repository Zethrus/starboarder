// src/events/ready.js
const { Events, PermissionFlagsBits } = require('discord.js'); // <-- Add PermissionFlagsBits
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers'); // <-- Add writeDb

// Helper function to format emoji for display
function formatEmoji(emoji) {
  if (!emoji) return '⭐'; // Default emoji
  if (emoji.isCustom) {
    return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  }
  return emoji.name;
}

/**
 * Checks for unverified members, sends reminders, and purges if configured.
 * @param {Client} client The Discord client instance.
 */
async function checkUnverifiedMembers(client) {
  console.log('[TASK] Running daily check for unverified members...');
  const db = readDb();
  if (!db.memberJoinDates) {
    console.log('[TASK] No member join dates found in DB. Skipping check.');
    return;
  }

  const unverifiedRoleName = config.unverifiedRoleName.toLowerCase();
  const reminderDays = config.verificationReminderDelayDays;
  const purgeDays = config.purgeDelayDays;
  const now = new Date();

  // 24 hours in milliseconds
  const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

  for (const guild of client.guilds.cache.values()) {
    const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase() === unverifiedRoleName);
    if (!unverifiedRole) {
      console.warn(`[TASK] Unverified role "${config.unverifiedRoleName}" not found in guild "${guild.name}". Skipping.`);
      continue;
    }

    // Check if the bot has Kick Members permission before proceeding with purge checks
    const canKick = guild.members.me.permissions.has(PermissionFlagsBits.KickMembers);
    if (config.enableAutoPurge && !canKick) {
      console.error(`[TASK] Auto-purge is enabled, but I do not have the "Kick Members" permission in "${guild.name}". Purge check will be skipped.`);
    }

    const members = await guild.members.fetch();

    for (const member of members.values()) {
      if (member.user.bot || !member.roles.cache.has(unverifiedRole.id)) {
        continue;
      }

      const joinDateStr = db.memberJoinDates[member.id];
      if (!joinDateStr) continue;

      const joinDate = new Date(joinDateStr);
      const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

      // --- PURGE LOGIC ---
      if (config.enableAutoPurge && canKick && daysDifference > purgeDays) {
        try {
          await member.kick(`Auto-purged for not completing verification within ${purgeDays} days.`);
          console.log(`[TASK] Purged (kicked) user ${member.user.tag} for being unverified for over ${purgeDays} days.`);
          // Delete their record so they aren't checked again unless they rejoin.
          delete db.memberJoinDates[member.id];
        } catch (error) {
          console.error(`[TASK] Failed to kick ${member.user.tag}:`, error);
        }

        // --- REMINDER LOGIC ---
      } else if (daysDifference > reminderDays) {
        try {
          await member.send(config.verificationReminderMessage);
          console.log(`[TASK] Sent verification reminder to ${member.user.tag}.`);

          // To prevent spamming the user, remove them from the check by deleting their entry.
          delete db.memberJoinDates[member.id];

        } catch (error) {
          if (error.code === 50007) { // DiscordAPIError: Cannot send messages to this user
            console.warn(`[TASK] Could not send DM to ${member.user.tag}. They may have DMs disabled.`);
          } else {
            console.error(`[TASK] Failed to send DM to ${member.user.tag}:`, error);
          }
        }
      }
    }
  }
  // Write the changes (deleted entries) back to the DB
  writeDb(db);
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

    // --- SCHEDULED TASK ---
    // Run the check once on startup, then every 24 hours.
    checkUnverifiedMembers(client);
    setInterval(() => checkUnverifiedMembers(client), 24 * 60 * 60 * 1000);
  },
};