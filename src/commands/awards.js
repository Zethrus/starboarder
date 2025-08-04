// src/commands/awards.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readDb, writeDb, replyThenDelete } = require('../utils/helpers');

// --- SUBCOMMAND HANDLERS ---

/**
 * Handles the "/award create" subcommand.
 */
async function handleCreateAward(interaction) {
  const awardName = interaction.options.getString('name');
  const role = interaction.options.getRole('role');

  const db = await readDb();
  if (db.awards[awardName]) {
    const existingRole = interaction.guild.roles.cache.get(db.awards[awardName]);
    return interaction.reply({ content: `An award named "${awardName}" already exists and is linked to the \`${existingRole?.name || 'Unknown Role'}\` role.`, ephemeral: true });
  }

  db.awards[awardName] = role.id;
  await writeDb(db);
  await interaction.reply({ content: `✅ Successfully created the **${awardName}** award, linked to the \`${role.name}\` role.` });
}

/**
 * Handles the "/award delete" subcommand.
 */
async function handleDeleteAward(interaction) {
  const awardName = interaction.options.getString('name');
  const db = await readDb();
  if (!db.awards[awardName]) {
    return interaction.reply({ content: `No award named "${awardName}" was found.`, ephemeral: true });
  }

  delete db.awards[awardName];
  for (const userId in db.userAwards) {
    if (db.userAwards[userId][awardName]) {
      delete db.userAwards[userId][awardName];
    }
  }
  await writeDb(db);
  await interaction.reply({ content: `✅ Successfully deleted the **${awardName}** award. It has been removed from the system and from all users.` });
}

/**
 * Handles the "/award add" subcommand.
 */
async function handleAddAward(interaction) {
  const user = interaction.options.getUser('user');
  const awardName = interaction.options.getString('name');
  const db = await readDb();
  if (!db.awards[awardName]) {
    return interaction.reply({ content: `The award "${awardName}" does not exist. Create it first with \`/award create\`.`, ephemeral: true });
  }

  const member = interaction.guild.members.cache.get(user.id);
  if (!member) {
    return interaction.reply({ content: 'That user could not be found in this server.', ephemeral: true });
  }

  const roleId = db.awards[awardName];
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    return interaction.reply({ content: `The role associated with this award (ID: ${roleId}) no longer exists. Please delete and recreate the award.`, ephemeral: true });
  }

  await member.roles.add(role).catch(console.error);
  db.userAwards[user.id] = db.userAwards[user.id] || {};
  db.userAwards[user.id][awardName] = (db.userAwards[user.id][awardName] || 0) + 1;
  await writeDb(db);

  await interaction.reply({ content: `🏆 Gave the **${awardName}** award to ${user.tag}. They now have ${db.userAwards[user.id][awardName]}.` });
}

/**
 * Handles the "/award remove" subcommand.
 */
async function handleRemoveAward(interaction) {
  const user = interaction.options.getUser('user');
  const awardName = interaction.options.getString('name');
  const db = await readDb();

  if (!db.awards[awardName]) {
    return interaction.reply({ content: `The award "${awardName}" does not exist.`, ephemeral: true });
  }
  if (!db.userAwards[user.id] || !db.userAwards[user.id][awardName] || db.userAwards[user.id][awardName] === 0) {
    return interaction.reply({ content: `${user.tag} does not have the "${awardName}" award.`, ephemeral: true });
  }

  db.userAwards[user.id][awardName]--;
  let replyMessage = `➖ Removed one **${awardName}** award from ${user.tag}. They now have ${db.userAwards[user.id][awardName]}.`;

  if (db.userAwards[user.id][awardName] === 0) {
    delete db.userAwards[user.id][awardName];
    const member = interaction.guild.members.cache.get(user.id);
    const roleId = db.awards[awardName];
    if (member && roleId) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.remove(role).catch(console.error);
        replyMessage += ` The \`${role.name}\` role has been removed.`;
      }
    }
  }
  await writeDb(db);
  await interaction.reply({ content: replyMessage });
}

/**
 * Handles the "/award display" subcommand.
 */
async function handleDisplayAwards(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const db = await readDb();
  const userAwardsData = db.userAwards[user.id];

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: `${user.username}'s Trophy Case`, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));

  if (!userAwardsData || Object.keys(userAwardsData).length === 0) {
    embed.setDescription('This trophy case is empty. Go out and earn some awards!');
  } else {
    const sortedAwards = Object.entries(userAwardsData).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    const awardsString = sortedAwards.map(([awardName, count]) => `🏆 **${awardName.charAt(0).toUpperCase() + awardName.slice(1)}** (x${count})`).join('\n');
    embed.addFields({ name: 'Collected Awards', value: awardsString });
  }
  await interaction.reply({ embeds: [embed] });
}

/**
 * Handles the "/award top" subcommand.
 */
async function handleTopAwards(interaction) {
  const db = await readDb();
  const userAwards = db.userAwards;

  if (!userAwards || Object.keys(userAwards).length === 0) {
    return interaction.reply({ content: 'No one has been given any awards yet.' });
  }

  const totals = Object.entries(userAwards).map(([userId, awards]) => {
    const totalCount = Object.values(awards).reduce((sum, count) => sum + count, 0);
    return { userId, totalCount };
  });

  totals.sort((a, b) => b.totalCount - a.totalCount);
  const top10 = totals.slice(0, 10);

  const leaderboardEntries = await Promise.all(
    top10.map(async (entry, index) => {
      try {
        const user = await interaction.client.users.fetch(entry.userId);
        return `**${index + 1}.** ${user.tag} - **${entry.totalCount}** Awards`;
      } catch {
        return `**${index + 1}.** *Unknown User (${entry.userId})* - **${entry.totalCount}** Awards`;
      }
    })
  );

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🏆 Awards Leaderboard')
    .setDescription(leaderboardEntries.join('\n'))
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

/**
 * Handles the "/award list" subcommand.
 */
async function handleListAwards(interaction) {
  const db = await readDb();
  const awards = db.awards;

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('📝 Available Awards List')
    .setTimestamp();

  if (!awards || Object.keys(awards).length === 0) {
    embed.setDescription('No awards have been created yet. Use `/award create` to make one.');
  } else {
    embed.setDescription('Here are all the awards that have been created in the system:');
    for (const [awardName, roleId] of Object.entries(awards)) {
      const role = interaction.guild.roles.cache.get(roleId);
      const roleName = role ? `@${role.name}` : '`Role Not Found`';
      const capitalizedAwardName = awardName.charAt(0).toUpperCase() + awardName.slice(1);
      embed.addFields({ name: `**${capitalizedAwardName}**`, value: `Linked to role: ${roleName}`, inline: false });
    }
  }
  await interaction.reply({ embeds: [embed] });
}


// --- MAIN EXPORT ---
module.exports = {
  data: new SlashCommandBuilder()
    .setName('award')
    .setDescription('Manages the award system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Creates a new award linked to a role.')
        .addStringOption(option => option.setName('name').setDescription('The name of the new award.').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The role to link to this award.').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Deletes an existing award from the system.')
        .addStringOption(option => option.setName('name').setDescription('The name of the award to delete.').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Gives an award to a user.')
        .addStringOption(option => option.setName('name').setDescription('The name of the award.').setRequired(true))
        .addUserOption(option => option.setName('user').setDescription('The user to give the award to.').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Removes an award from a user.')
        .addStringOption(option => option.setName('name').setDescription('The name of the award.').setRequired(true))
        .addUserOption(option => option.setName('user').setDescription('The user to remove the award from.').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('display')
        .setDescription('Shows the awards earned by a user.')
        .addUserOption(option => option.setName('user').setDescription('The user whose awards to display (defaults to you).'))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('top')
        .setDescription('Displays the server-wide awards leaderboard.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lists all created awards available to be given.')
    ),

  async execute(interaction) {
    const subCommand = interaction.options.getSubcommand();

    // Permissions check for public commands
    const publicCommands = ['display', 'top'];
    if (!publicCommands.includes(subCommand) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You must be an Administrator to use this subcommand.', ephemeral: true });
    }

    // --- SUBCOMMAND ROUTER ---
    switch (subCommand) {
      case 'create':
        await handleCreateAward(interaction);
        break;
      case 'delete':
        await handleDeleteAward(interaction);
        break;
      case 'add':
        await handleAddAward(interaction);
        break;
      case 'remove':
        await handleRemoveAward(interaction);
        break;
      case 'display':
        await handleDisplayAwards(interaction);
        break;
      case 'top':
        await handleTopAwards(interaction);
        break;
      case 'list':
        await handleListAwards(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  },
};