// src/commands/award.js
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readDb, writeDb, replyThenDelete } = require('../utils/helpers');

module.exports = {
  name: 'award',
  description: 'Manages the award system.',
  async execute(message, args) {
    // Get the subcommand (e.g., 'create', 'add', 'remove')
    const subCommand = args.shift()?.toLowerCase();

    if (!subCommand) {
      return replyThenDelete(message, 'Usage: `!award <create|delete|add|remove|display> ...`');
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
  const userAwards = db.userAwards[user.id];

  const embed = new EmbedBuilder()
    .setColor(0x3498DB) // Blue color
    .setAuthor({ name: `${user.username}'s Awards`, iconURL: user.displayAvatarURL() });

  if (!userAwards || Object.keys(userAwards).length === 0) {
    embed.setDescription('This user has no awards yet.');
  } else {
    const sortedAwards = Object.entries(userAwards).sort((a, b) => b[1] - a[1]);
    embed.setDescription('Here is a list of all awards they have earned:');
    for (const [awardName, count] of sortedAwards) {
      embed.addFields({ name: awardName, value: `🏆 x ${count}`, inline: true });
    }
  }
  await message.channel.send({ embeds: [embed] });
}
