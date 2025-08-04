// src/events/messageCreate.js
const { Events } = require('discord.js');
const config = require('../../config');
const handleThemeSubmission = require('../features/themeSubmit');

const COMMAND_PREFIX = '!';

module.exports = {
	name: Events.MessageCreate,
	async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;

        // --- THEME SUBMISSION FEATURE ---
        // Check if the message is in the photography channel for a potential theme submission
        if (message.channel.name === config.photographyChannel) {
            await handleThemeSubmission(message);
        }

        // --- PREFIX COMMAND HANDLER ---
        if (!message.content.startsWith(COMMAND_PREFIX)) return;

        // Parse command and arguments
        const args = message.content.slice(COMMAND_PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command) return;

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`Error executing command !${commandName}:`, error);
            await message.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
	},
};
