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
      return replyThenDelete(message, 'Please provide a subcommand. Usage: `!award <create|add|remove|display> ...`');
    }

    // --- SUBCOMMAND ROUTER ---
    switch (subCommand) {
      case 'create':
        await handleCreateAward(message, args);
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
 * Usage: !award create <awardName> <@role>
 * @param {Message} message The Discord message object.
 * @param {string[]} args The arguments for the subcommand.
 */
async function handleCreateAward(message, args) {
  // Check for Administrator permissions
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return replyThenDelete(message, 'You must be an Administrator to create new awards.');
  }

  // Check for correct number of arguments
  if (args.length < 2) {
    return replyThenDelete(message, 'Usage: `!award create <awardName> <@role>`');
  }

  const awardName = args[0].toLowerCase();
  const role = message.mentions.roles.first();

  // Validate the role
  if (!role) {
    return replyThenDelete(message, 'You must mention a valid role to associate with this award.');
  }

  const db = readDb();

  // Check if an award with this name already exists
  if (db.awards[awardName]) {
    const existingRole = message.guild.roles.cache.get(db.awards[awardName]);
    return replyThenDelete(message, `An award named "${awardName}" already exists and is linked to the \`${existingRole?.name || 'Unknown Role'}\` role.`);
  }

  // Save the new award to the database
  db.awards[awardName] = role.id;
  writeDb(db);

  await message.reply(`✅ Successfully created the **${awardName}** award, linked to the \`${role.name}\` role.`);
  console.log(`[AWARDS] User ${message.author.tag} created award "${awardName}" linked to role ${role.name} (${role.id})`);
}
