// src/events/guildMemberAdd.js
const { Events } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');
const handleBanEvasion = require('../features/banEvasion');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot) return;

    console.log(`[MEMBERS] New user joined: ${member.user.tag} (${member.id})`);

    // --- DATABASE LOGIC ---
    const db = await readDb();
    if (!db.memberJoinDates) {
      db.memberJoinDates = {};
    }

    db.memberJoinDates[member.id] = {
      joined: new Date().toISOString(),
      reminderSent: false
    };
    await writeDb(db);
    // ----------------------

    // --- BAN EVASION CHECK ---
    // This runs after logging their join date.
    await handleBanEvasion(member);
    // -------------------------
  },
};