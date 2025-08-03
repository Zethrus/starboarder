// src/commands/award.js
const { PermissionFlagsBits } = require('discord.js');
const { readDb, writeDb, replyThenDelete } = require('../utils/helpers');

module.exports = {
  name: 'award',
  description: 'Manages the award system.',
  async execute(message, args) {
    // Get the subcommand (e.g., 'create', 'add', 'remove')
    const subCommand = args.shift()?.toLowerCase();

    if (!subCommand) {
      return replyThenDelete(message, 'Please provide a subcommand. Usage: `!award <create|delete|add|remove|display> ...`');
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
        // We will implement this next
        await replyThenDelete(message, '`!award add` is not yet implemented.');
        break;
      case 'remove':
        // We will implement this next
        await replyThenDelete(message, '`!award remove` is not yet implemented.');
        break;
      case 'display':
        // We will implement this next
        await replyThenDelete(message, '`!award display` is not yet implemented.');
        break;
      default:
        await replyThenDelete(message, `Unknown subcommand "${subCommand}".`);
    }
  },
};

// --- SUBCOMMAND HANDLERS ---

/**
 * Handles the "!award create" subcommand.
 * Allows for multi-word award names and handles quotes.
 * @param {Message} message The Discord message object.
 * @param {string[]} args The arguments for the subcommand.
 */
async function handleCreateAward(message, args) {
  // Check for Administrator permissions
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to create new awards.');
  }

  if (args.length < 2) {
    return replyThenDelete(message, 'Usage: `!award create <award name> <@role>`');
  }

  const role = message.mentions.roles.first();
  const roleMention = args[args.length - 1];

  if (!role || !roleMention.startsWith('<@&') || !roleMention.endsWith('>')) {
    return replyThenDelete(message, 'You must mention a valid role at the end of the command.');
  }

  let awardName = args.slice(0, -1).join(' ');

  // Sanitize the name: lowercase, trim, remove quotes, and normalize whitespace
  awardName = awardName.toLowerCase().trim().replace(/^"(.+(?="$))"$/, '$1').replace(/\s+/g, ' ');


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
  console.log(`[AWARDS] User ${message.author.tag} created award "${awardName}" linked to role ${role.name} (${role.id})`);
}

/**
 * Handles the "!award delete" subcommand.
 * Allows for multi-word award names and handles quotes.
 * @param {Message} message The Discord message object.
 * @param {string[]} args The arguments for the subcommand.
 */
async function handleDeleteAward(message, args) {
  // Check for Administrator permissions
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to delete awards.');
  }

  if (args.length < 1) {
    return replyThenDelete(message, 'Usage: `!award delete <award name>`');
  }

  let awardName = args.join(' ');

  // Sanitize the name: lowercase, trim, remove quotes, and normalize whitespace
  awardName = awardName.toLowerCase().trim().replace(/^"(.+(?="$))"$/, '$1').replace(/\s+/g, ' ');

  const db = readDb();

  if (!db.awards[awardName]) {
    return replyThenDelete(message, `No award named "${awardName}" was found.`);
  }

  delete db.awards[awardName];
  writeDb(db);

  await message.reply(`✅ Successfully deleted the **${awardName}** award. It is no longer associated with any role.`);
  console.log(`[AWARDS] User ${message.author.tag} deleted award "${awardName}".`);
}
