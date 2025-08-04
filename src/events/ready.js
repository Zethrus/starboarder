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
  // Add a header to the log to show the current mode
  const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
  console.log(`[TASK] ${mode} Running daily check for unverified members...`);

  const db = readDb();
  if (!db.memberJoinDates || Object.keys(db.memberJoinDates).length === 0) {
    console.log(`[TASK] No members are currently being tracked. Skipping check.`);
    return;
  }

  const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
  const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
  const reminderDays = config.verificationReminderDelayDays;
  const purgeDays = config.purgeDelayDays;
  const now = new Date();

  for (const guild of client.guilds.cache.values()) {
    const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelName);
    const unverifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === unverifiedRoleName);
    const verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase().trim() === verifiedRoleName);

    if (!unverifiedRole) {
      console.warn(`[TASK] Unverified role "${config.unverifiedRoleName}" not found in guild "${guild.name}". Skipping.`);
      continue;
    }
    if (!verifiedRole && logChannel) {
      await logChannel.send(`⚠️ **Warning:** Verified role "${config.verifiedRoleName}" not found. Safety checks may be affected.`);
    }

    const canKick = guild.members.me.permissions.has(PermissionFlagsBits.KickMembers);

    const members = await guild.members.fetch({ force: true });
    let dbModified = false;
    const trackedUserIds = Object.keys(db.memberJoinDates);

    for (const memberId of trackedUserIds) {
      const member = members.get(memberId);

      if (!member) {
        // ... (Cleanup logic for left members remains the same)
        continue;
      }

      const isVerified = verifiedRole && member.roles.cache.has(verifiedRole.id);
      const isUnverified = member.roles.cache.has(unverifiedRole.id);

      if (isVerified || !isUnverified) {
        // ... (Cleanup logic for verified members remains the same)
        continue;
      }

      const joinDate = new Date(db.memberJoinDates[memberId].joined);
      const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

      // --- PURGE LOGIC ---
      if (config.enableAutoPurge && canKick && daysDifference > purgeDays) {
        const purgeLogMessage = `👢 **Purge Target**: ${member.user.tag} (${member.id}) has been unverified for ${daysDifference.toFixed(1)} days.`;
        if (config.enableDryRun) {
          console.log(`[DRY RUN] Would purge ${member.user.tag}.`);
          if (logChannel) await logChannel.send(`[DRY RUN] ${purgeLogMessage}`);
        } else {
          try {
            const kickReason = `Auto-purged for not completing verification within ${purgeDays} days.`;
            await member.kick(kickReason);
            if (logChannel) await logChannel.send(purgeLogMessage);
            delete db.memberJoinDates[memberId];
            dbModified = true;
          } catch (error) {
            console.error(`[TASK] Failed to kick ${member.user.tag}:`, error);
          }
        }
        continue;
      }

      // --- REMINDER LOGIC ---
      if (daysDifference > reminderDays && !db.memberJoinDates[memberId].reminderSent) {
        const reminderLogMessage = `🔔 **Reminder Target**: ${member.user.tag} (${member.id}) has been unverified for ${daysDifference.toFixed(1)} days.`;
        if (config.enableDryRun) {
          console.log(`[DRY RUN] Would send reminder to ${member.user.tag}.`);
          if (logChannel) await logChannel.send(`[DRY RUN] ${reminderLogMessage}`);
        } else {
          try {
            await member.send(config.verificationReminderMessage);
            if (logChannel) await logChannel.send(reminderLogMessage.replace("Target", "Sent"));
            db.memberJoinDates[memberId].reminderSent = true;
            dbModified = true;
          } catch (error) {
            // ... (error handling)
          }
        }
      }
    }

    if (dbModified && !config.enableDryRun) {
      writeDb(db);
    }
  }
}


// We also need to fix the database structure for tracking.
function initializeDbAndTracking() {
  const db = readDb();
  let modified = false;

  // Ensure memberJoinDates exists
  if (db.memberJoinDates === undefined) {
    db.memberJoinDates = {};
    modified = true;
  }

  // Convert old string-based join dates to the new object structure
  for (const memberId in db.memberJoinDates) {
    if (typeof db.memberJoinDates[memberId] === 'string') {
      const joinDate = db.memberJoinDates[memberId];
      db.memberJoinDates[memberId] = {
        joined: joinDate,
        reminderSent: false // Assume no reminder was sent for old entries
      };
      modified = true;
    }
  }

  if (modified) {
    console.log('[DB] Upgrading member tracking database structure...');
    writeDb(db);
  }
}


module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Configuration:`);
    console.log(`- Starboard Channel: #${config.starboardChannel}`);
    console.log(`- Required Stars: ${config.requiredStars}`);
    // ... other logs

    // Initialize/Upgrade DB structure
    initializeDbAndTracking();

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