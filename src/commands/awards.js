// src/commands/awards.js
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readDb, writeDb, replyThenDelete } = require('../utils/helpers');

module.exports = {
  name: 'award',
  description: 'Manages the award system.',
  async execute(message, args) {
    // Get the subcommand (e.g., 'create', 'add', 'remove')
    const subCommand = args.shift()?.toLowerCase();

    if (!subCommand) {
      return replyThenDelete(message, 'Usage: `!award <create|delete|add|remove|display|top|list> ...`');
    }

    // --- SUBCOMMAND ROUTER ---
    switch (subCommand) {
      case 'create':
        await handleCreateAward(message, args);
        break;
      case 'delete':
        await handleDeleteAward(message, args);
        break;
      case 'add':
        await handleAddAward(message, args);
        break;
      case 'remove':
        await handleRemoveAward(message, args);
        break;
      case 'display':
        await handleDisplayAwards(message, args);
        break;
      case 'top':
        await handleTopAwards(message);
        break;
      case 'list':
        await handleListAwards(message);
        break;
      default:
        await replyThenDelete(message, `Unknown subcommand "${subCommand}".`);
    }
  },
};

// --- HELPER FUNCTION ---
function sanitizeAwardName(args) {
  let awardName = args.join(' ');
  return awardName.toLowerCase().trim().replace(/^"(.+(?="$))"$/, '$1').replace(/\s+/g, ' ');
}


// --- SUBCOMMAND HANDLERS ---

/**
 * Handles the "!award create" subcommand.
 * Usage: !award create <award name> <@role>
 */
async function handleCreateAward(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to create new awards.');
  }
  if (args.length < 2) {
    return replyThenDelete(message, 'Usage: `!award create <award name> <@role>`');
  }
  const role = message.mentions.roles.first();
  if (!role) {
    return replyThenDelete(message, 'You must mention a valid role at the end of the command.');
  }
  const awardName = sanitizeAwardName(args.slice(0, -1));
  if (!awardName) {
    return replyThenDelete(message, 'You must provide a name for the award.');
  }
  const db = readDb();
  if (db.awards[awardName]) {
    const existingRole = message.guild.roles.cache.get(db.awards[awardName]);
    return replyThenDelete(message, `An award named "${awardName}" already exists and is linked to the \`${existingRole?.name || 'Unknown Role'}\` role.`);
  }
  db.awards[awardName] = role.id;
  writeDb(db);
  await message.reply(`✅ Successfully created the **${awardName}** award, linked to the \`${role.name}\` role.`);
}

/**
 * Handles the "!award delete" subcommand.
 * Usage: !award delete <award name>
 */
async function handleDeleteAward(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to delete awards.');
  }
  if (args.length < 1) {
    return replyThenDelete(message, 'Usage: `!award delete <award name>`');
  }
  const awardName = sanitizeAwardName(args);
  const db = readDb();
  if (!db.awards[awardName]) {
    return replyThenDelete(message, `No award named "${awardName}" was found.`);
  }
  delete db.awards[awardName];
  // Optional: Also remove this award from all users who have it
  for (const userId in db.userAwards) {
    if (db.userAwards[userId][awardName]) {
      delete db.userAwards[userId][awardName];
    }
  }
  writeDb(db);
  await message.reply(`✅ Successfully deleted the **${awardName}** award. It has been removed from the system and from all users.`);
}

/**
 * Handles the "!award add" subcommand.
 * Usage: !award add <award name> <@user>
 */
async function handleAddAward(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to give awards.');
  }
  if (args.length < 2) {
    return replyThenDelete(message, 'Usage: `!award add <award name> <@user>`');
  }
  const user = message.mentions.users.first();
  if (!user) {
    return replyThenDelete(message, 'You must mention a valid user to give the award to.');
  }
  const awardName = sanitizeAwardName(args.slice(0, -1));
  const db = readDb();
  if (!db.awards[awardName]) {
    return replyThenDelete(message, `The award "${awardName}" does not exist. Create it first with \`!award create\`.`);
  }
  const member = message.guild.members.cache.get(user.id);
  if (!member) {
    return replyThenDelete(message, 'That user could not be found in this server.');
  }
  const roleId = db.awards[awardName];
  const role = message.guild.roles.cache.get(roleId);
  if (!role) {
    return replyThenDelete(message, `The role associated with this award (ID: ${roleId}) no longer exists. Please delete and recreate the award.`);
  }

  // Give the user the role
  await member.roles.add(role).catch(console.error);

  // Update the database
  db.userAwards[user.id] = db.userAwards[user.id] || {};
  db.userAwards[user.id][awardName] = (db.userAwards[user.id][awardName] || 0) + 1;
  writeDb(db);

  await message.reply(`🏆 Gave the **${awardName}** award to ${user.tag}. They now have ${db.userAwards[user.id][awardName]}.`);
}

/**
 * Handles the "!award remove" subcommand.
 * Usage: !award remove <award name> <@user>
 */
async function handleRemoveAward(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to remove awards.');
  }
  if (args.length < 2) {
    return replyThenDelete(message, 'Usage: `!award remove <award name> <@user>`');
  }
  const user = message.mentions.users.first();
  if (!user) {
    return replyThenDelete(message, 'You must mention a valid user to remove the award from.');
  }
  const awardName = sanitizeAwardName(args.slice(0, -1));
  const db = readDb();
  if (!db.awards[awardName]) {
    return replyThenDelete(message, `The award "${awardName}" does not exist.`);
  }
  if (!db.userAwards[user.id] || !db.userAwards[user.id][awardName] || db.userAwards[user.id][awardName] === 0) {
    return replyThenDelete(message, `${user.tag} does not have the "${awardName}" award.`);
  }

  // Decrement the award count
  db.userAwards[user.id][awardName]--;

  let replyMessage = `➖ Removed one **${awardName}** award from ${user.tag}. They now have ${db.userAwards[user.id][awardName]}.`;

  // If the count is now zero, remove the role
  if (db.userAwards[user.id][awardName] === 0) {
    delete db.userAwards[user.id][awardName]; // Clean up the entry
    const member = message.guild.members.cache.get(user.id);
    const roleId = db.awards[awardName];
    if (member && roleId) {
      const role = message.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.remove(role).catch(console.error);
        replyMessage += ` The \`${role.name}\` role has been removed.`;
      }
    }
  }
  writeDb(db);
  await message.reply(replyMessage);
}

/**
 * Handles the "!award display" subcommand.
 * Usage: !award display [@user]
 */
async function handleDisplayAwards(message, args) {
  const user = message.mentions.users.first() || message.author;
  const db = readDb();
  const userAwardsData = db.userAwards[user.id];

  const embed = new EmbedBuilder()
    .setColor(0x3498DB) // Blue color
    .setAuthor({ name: `${user.username}'s Trophy Case`, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));

  if (!userAwardsData || Object.keys(userAwardsData).length === 0) {
    embed.setDescription('This trophy case is empty. Go out and earn some awards!');
  } else {
    // Sort awards by count descending, then alphabetically
    const sortedAwards = Object.entries(userAwardsData).sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    });

    embed.setDescription('Here is a list of all awards they have earned:');

    // Using a single field for a cleaner, list-like appearance
    const awardsString = sortedAwards
      .map(([awardName, count]) => `🏆 **${awardName.charAt(0).toUpperCase() + awardName.slice(1)}** (x${count})`)
      .join('\n');

    embed.addFields({ name: 'Collected Awards', value: awardsString });
  }
  await message.channel.send({ embeds: [embed] });
}

/**
 * Handles the "!award top" subcommand.
 * Displays a leaderboard of users with the most awards.
 * @param {Message} message
 */
async function handleTopAwards(message) {
  const db = readDb();
  const userAwards = db.userAwards;

  if (!userAwards || Object.keys(userAwards).length === 0) {
    return message.reply('No one has been given any awards yet.');
  }

  // 1. Calculate total awards for each user
  const totals = Object.entries(userAwards).map(([userId, awards]) => {
    const totalCount = Object.values(awards).reduce((sum, count) => sum + count, 0);
    return { userId, totalCount };
  });

  // 2. Sort by total awards descending
  totals.sort((a, b) => b.totalCount - a.totalCount);

  // 3. Get the top 10
  const top10 = totals.slice(0, 10);

  // 4. Fetch user details and format the leaderboard string
  const leaderboardEntries = await Promise.all(
    top10.map(async (entry, index) => {
      try {
        const user = await message.client.users.fetch(entry.userId);
        return `**${index + 1}.** ${user.tag} - **${entry.totalCount}** Awards`;
      } catch {
        return `**${index + 1}.** *Unknown User (${entry.userId})* - **${entry.totalCount}** Awards`;
      }
    })
  );

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F) // Gold color
    .setTitle('🏆 Awards Leaderboard')
    .setDescription(leaderboardEntries.join('\n'))
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

/**
 * Handles the "!award list" subcommand (Admin only).
 * Lists all created awards and their linked roles.
 * @param {Message} message
 */
async function handleListAwards(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to run this command.');
  }

  const db = readDb();
  const awards = db.awards;

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71) // Green color
    .setTitle('📝 Available Awards List')
    .setTimestamp();

  if (!awards || Object.keys(awards).length === 0) {
    embed.setDescription('No awards have been created yet. Use `!award create` to make one.');
  } else {
    embed.setDescription('Here are all the awards that have been created in the system:');
    for (const [awardName, roleId] of Object.entries(awards)) {
      const role = message.guild.roles.cache.get(roleId);
      const roleName = role ? `@${role.name}` : '`Role Not Found`';
      const capitalizedAwardName = awardName.charAt(0).toUpperCase() + awardName.slice(1);
      embed.addFields({
        name: `**${capitalizedAwardName}**`,
        value: `Linked to role: ${roleName}`,
        inline: false,
      });
    }
  }

  await message.channel.send({ embeds: [embed] });
}