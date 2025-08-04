// index.js
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const config = require('./config');
const { initializeDb } = require('./src/utils/helpers');

// --- DATABASE INITIALIZATION ---
// This runs once at startup to ensure the db.json file exists.
initializeDb();
// -----------------------------

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // Add this for user join/leave events
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
});

// --- COMMAND HANDLER ---
// A Collection is used to store and efficiently retrieve commands for execution
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) { // <-- Check for 'data' instead of 'name'
    client.commands.set(command.data.name, command); // <-- Use command.data.name
    console.log(`[COMMANDS] Loaded command: /${command.data.name}`);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// --- EVENT HANDLER ---
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[EVENTS] Loaded event: ${event.name}`);
}


// Log in to Discord with your client's token
client.login(config.discordToken);
