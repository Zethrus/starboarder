// src/events/messageReactionRemove.js
const { Events } = require('discord.js');
const handleStarboard = require('../features/starboard');

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // --- STARBOARD FEATURE ---
    // The same handler can manage adds and removes
    await handleStarboard(reaction, user);
  },
};