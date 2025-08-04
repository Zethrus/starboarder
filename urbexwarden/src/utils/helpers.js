// src/utils/helpers.js
const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../../config');

// --- DATABASE HELPERS ---
const dbPath = path.join(__dirname, '..', '..', 'db.json');
const defaultDbStructure = {
  awards: {},
  userAwards: {},
  reactionRoleMessageId: null,
  memberJoinDates: {},
  starboardPosts: {}, // <-- RENAMED AND WILL STORE { originalMsgId: starboardMsgId }
};

/**
 * Checks if the database file exists, and creates it with a default structure if it doesn't.
 * This should be run once at bot startup.
 */
function initializeDb() {
  if (!fs.existsSync(dbPath)) {
    console.log('[DB] Database file not found. Creating a new one...');
    writeDb(JSON.parse(JSON.stringify(defaultDbStructure)));
  } else {
    // Also handle case where db.json exists but is from an older version
    const db = await readDb();
    let dbModified = false;
    if (db.memberJoinDates === undefined) {
      console.log('[DB] Adding new `memberJoinDates` property to existing database.');
      db.memberJoinDates = {};
      dbModified = true;
    }
    // Migration from the previous starboard implementation
    if (db.starredMessageIds !== undefined) {
      console.log('[DB] Migrating `starredMessageIds` to `starboardPosts`.');
      delete db.starredMessageIds;
      db.starboardPosts = {};
      dbModified = true;
    }
    if (db.starboardPosts === undefined) {
      console.log('[DB] Adding new `starboardPosts` property to existing database.');
      db.starboardPosts = {};
      dbModified = true;
    }
    if (dbModified) {
      await writeDb(db);
    }
  }
}

/**
 * Reads the entire database from db.json.
 * @returns {object} The parsed database object.
 */
async function readDb() {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') { // File doesn't exist
      console.log("[DB] Database file not found. Returning default structure.");
      return JSON.parse(JSON.stringify(defaultDbStructure));
    }
    console.error("Fatal error reading from database. Returning default structure.", error);
    return JSON.parse(JSON.stringify(defaultDbStructure));
  }
}

/**
 * Writes an object to the database file.
 * @param {object} data The data object to write to the database.
 */
async function writeDb(data) { 
  try {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2)); 
  } catch (error) {
    console.error("Error writing to database:", error);
  }
}


// --- MESSAGE & EMOJI HELPERS ---

/**
 * Extracts an image URL from a message.
 * Can optionally enforce that only one image is present.
 * @param {Message} message The Discord message object.
 * @param {boolean} enforceSingleImage If true, returns null if more than one image is found.
 * @returns {string|null} The URL of the image, or null if not found or criteria not met.
 */
function getImageFromMessage(message, enforceSingleImage = false) {
  const images = [];
  message.attachments.forEach(att => {
    if (att.contentType && att.contentType.startsWith('image/')) {
      images.push(att.url);
    }
  });
  message.embeds.forEach(embed => {
    if (embed.image) images.push(embed.image.url);
    if (embed.thumbnail) images.push(embed.thumbnail.url);
  });
  if (enforceSingleImage && images.length !== 1) {
    console.log(`Image check failed: Found ${images.length} images, but exactly 1 was required.`);
    return null;
  }
  return images.length > 0 ? images[0] : null;
}

/**
 * Formats a parsed emoji object for display in messages.
 * @param {object} emoji The parsed emoji object from config.
 * @returns {string} The formatted emoji string.
 */
function formatEmoji(emoji) {
  if (!emoji) return '⭐'; // Default
  if (emoji.isCustom) {
    return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  }
  return emoji.name;
}

/**
 * Sends a reply to a message and then deletes the reply after a specified time.
 * @param {Message} message The message to reply to.
 * @param {string} content The content of the reply.
 * @param {number} [delay=config.replyDeleteDelay] The time in milliseconds to wait before deleting the reply.
 */
async function replyThenDelete(message, content, delay = config.replyDeleteDelay) {
  try {
    const reply = await message.reply(content);
    setTimeout(() => {
      reply.delete().catch(err => console.error("Failed to delete reply:", err));
    }, delay);
  } catch (error) {
    console.error("Failed to send or schedule deletion for reply:", error);
  }
}


module.exports = {
  initializeDb,
  readDb,
  writeDb,
  getImageFromMessage,
  formatEmoji,
  replyThenDelete,
};