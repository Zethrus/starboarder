// src/events/messageReactionAdd.js
const { Events } = require('discord.js');
const handleStarboard = require('../features/starboard');
const { readDb, writeDb } = require('../utils/helpers');
const { checkVerificationStatus } = require('../features/verification');
const config = require('../../config');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    try {
      const db = await readDb();
      if (reaction.message.id === db.verificationMessageId && reaction.emoji.name === '✅') {
        const member = await reaction.message.guild.members.fetch(user.id);
        const logChannel = reaction.message.guild.channels.cache.find(c => c.name === config.logChannelName);

        // Remove reaction to indicate processing and prevent spam
        await reaction.users.remove(user.id);

        const status = await checkVerificationStatus(member);

        if (status.success) {
          const verifiedRole = reaction.message.guild.roles.cache.find(r => r.name.toLowerCase().trim() === config.verifiedRoleName.toLowerCase().trim());
          const unverifiedRole = reaction.message.guild.roles.cache.find(r => r.name.toLowerCase().trim() === config.unverifiedRoleName.toLowerCase().trim());

          if (verifiedRole) {
            await member.roles.add(verifiedRole);
          } else {
            if (logChannel) await logChannel.send(`⚠️ **Verification Warning**: Could not find role "${config.verifiedRoleName}" to assign to ${user.tag}.`);
          }

          if (unverifiedRole) {
            await member.roles.remove(unverifiedRole);
          }

          // Clean up their verification progress from DB
          if (db.verificationProgress?.[user.id]) {
            delete db.verificationProgress[user.id];
            await writeDb(db);
          }

          const successMessage = `✅ **Welcome, ${user.tag}!** You have successfully completed all verification steps and have been granted full access to the server.`;
          await user.send(successMessage).catch(() => console.log(`Could not DM user ${user.tag} after verification.`));
          if (logChannel) await logChannel.send(`✅ **Member Verified**: ${user.tag} has completed the verification process.`);

        } else {
          const failureMessage = `❌ **Verification Incomplete**\n\nWe noticed you tried to complete the verification process, but you are still missing the following step(s):\n\n- ${status.missing.join('\n- ')}\n\nPlease complete these steps and then react to the message in #how-2-member again.`;
          await user.send(failureMessage).catch(() => {
            if (logChannel) await logChannel.send(`⚠️ **Verification DM Failed**: Could not send verification failure details to ${user.tag}.`);
          });
        }
      }
    } catch (error) {
      console.error("Error processing verification reaction:", error);
    }

    // --- STARBOARD FEATURE ---
    await handleStarboard(reaction, user);
  },
};
