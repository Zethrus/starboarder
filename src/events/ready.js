// src/events/ready.js
const { Events, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb } = require('../utils/helpers');

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

  const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
  const reminderDays = config.verificationReminderDelayDays;
  const purgeDays = config.purgeDelayDays;
  const now = new Date();

  // 24 hours in milliseconds
  const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

  for (const guild of client.guilds.cache.values()) {
    const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
    const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);

    if (!unverifiedRole) {
      console.warn(`[TASK] Unverified role "${config.unverifiedRoleName}" not found in guild "${guild.name}". Skipping.`);
      continue;
    }

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
          const kickReason = `Auto-purged for not completing verification within ${purgeDays} days.`;
          await member.kick(kickReason);
          const logMessage = `👢 **Auto-Purged User**: ${member.user.tag} (${member.id})\n**Reason**: ${kickReason}`;
          console.log(`[TASK] ${logMessage.replace(/\n/g, ' ')}`);
          if (logChannel) await logChannel.send(logMessage);

          delete db.memberJoinDates[member.id];
        } catch (error) {
          console.error(`[TASK] Failed to kick ${member.user.tag}:`, error);
        }

        // --- REMINDER LOGIC ---
      } else if (daysDifference > reminderDays) {
        try {
          await member.send(config.verificationReminderMessage);
          const logMessage = `🔔 **Sent Reminder**: DM'd ${member.user.tag} (${member.id}) to complete verification.`;
          console.log(`[TASK] ${logMessage}`);
          if (logChannel) await logChannel.send(logMessage);

          delete db.memberJoinDates[member.id];

        } catch (error) {
          if (error.code === 50007) {
            console.warn(`[TASK] Could not send DM to ${member.user.tag}. They may have DMs disabled.`);
          } else {
            console.error(`[TASK] Failed to send DM to ${member.user.tag}:`, error);
          }
        }
      }
    }
  }
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
    checkUnverifiedMembers(client);
    setInterval(() => checkUnverifiedMembers(client), 24 * 60 * 60 * 1000);
  },
};