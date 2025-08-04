// src/events/guildMemberAdd.js
const { Events } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    // Ignore bots
    if (member.user.bot) return;

    console.log(`[MEMBERS] New user joined: ${member.user.tag} (${member.id})`);

    const db = readDb();
    // Ensure the join dates object exists
    if (!db.memberJoinDates) {
      db.memberJoinDates = {};
    }

    // Record the join timestamp as an ISO 8601 string
    db.memberJoinDates[member.id] = new Date().toISOString();
    writeDb(db);
  },
};