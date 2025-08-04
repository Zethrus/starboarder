// src/events/messageReactionAdd.js
const { Events } = require('discord.js');
const handleStarboard = require('../features/starboard');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // --- STARBOARD FEATURE ---
    await handleStarboard(reaction, user);
  },
};
