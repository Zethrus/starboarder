// src/events/guildMemberAdd.js
const { Events } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot) return;

    console.log(`[MEMBERS] New user joined: ${member.user.tag} (${member.id})`);

    const db = readDb();
    if (!db.memberJoinDates) {
      db.memberJoinDates = {};
    }

    // Store data in the new object format
    db.memberJoinDates[member.id] = {
      joined: new Date().toISOString(),
      reminderSent: false
    };
    writeDb(db);
  },
};