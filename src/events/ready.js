// src/events/ready.js
const { Events, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { readDb, writeDb, initializeDb } = require('../utils/helpers');

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
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function checkUnverifiedMembers(client) {
  const mode = config.enableDryRun ? '[DRY RUN]' : '[LIVE]';
  console.log(`[TASK] ${mode} Running daily check for unverified members...`);

  const db = await readDb();
  if (!db.memberJoinDates || Object.keys(db.memberJoinDates).length === 0) {
    console.log(`[TASK] No members are currently being tracked. Skipping check.`);
    return;
  }

  const unverifiedRoleName = config.unverifiedRoleName.toLowerCase().trim();
  const verifiedRoleName = config.verifiedRoleName.toLowerCase().trim();
  const reminderDays = config.verificationReminderDelayDays;
  const purgeDays = config.purgeDelayDays;
  const graceDays = config.purgeGracePeriodDays; // <-- Get the grace period
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
        // ... (Cleanup for left members)
        continue;
      }

      const isVerified = verifiedRole && member.roles.cache.has(verifiedRole.id);
      const isUnverified = member.roles.cache.has(unverifiedRole.id);

      if (isVerified || !isUnverified) {
        // ... (Cleanup for verified members)
        continue;
      }

      const joinDate = new Date(db.memberJoinDates[memberId].joined);
      const daysDifference = (now - joinDate) / (1000 * 3600 * 24);

      // --- PURGE LOGIC WITH GRACE PERIOD ---
      // The user is only purged if their time unverified exceeds the purge delay PLUS the grace period.
      if (config.enableAutoPurge && canKick && daysDifference > (purgeDays + graceDays)) {
        const purgeLogMessage = `👢 **Purge Target**: ${member.user.tag} (${member.id}) has been unverified for ${daysDifference.toFixed(1)} days (deadline: ${purgeDays}d, grace: ${graceDays}d).`;
        if (config.enableDryRun) {
          console.log(`[DRY RUN] Would purge ${member.user.tag}.`);
          if (logChannel) await logChannel.send(`[DRY RUN] ${purgeLogMessage}`);
        } else {
          try {
            const kickReason = `Auto-purged for not completing verification within the ${purgeDays}-day deadline plus ${graceDays}-day grace period.`;
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
        // ... (Reminder logic remains the same)
      }
    }

    if (dbModified && !config.enableDryRun) {
      await writeDb(db);
    }
  }
}


/**
 * Converts old string-based join dates in the database to the new object structure.
 * This is a one-time migration check that runs on startup.
 */
async function upgradeMemberTracking() {
  const db = await readDb();
  let modified = false;

  // This check is important to avoid errors on a fresh database
  if (!db.memberJoinDates) {
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
    await writeDb(db);
  }
}


module.exports = {
  name: Events.ClientReady,
  once: true,
  // Make the execute function async
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    // --- DATABASE INITIALIZATION ---
    // This now runs first inside an async context
    await initializeDb();
    await upgradeMemberTracking();
    // -----------------------------


    console.log(`Configuration:`);
    console.log(`- Starboard Channel: #${config.starboardChannel}`);
    console.log(`- Required Stars: ${config.requiredStars}`);
    // ... other logs

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