// src/features/verification.js
const config = require('../../config');
const { readDb } = require('../utils/helpers');

/**
 * Checks if a member has completed all verification steps.
 * @param {import('discord.js').GuildMember} member The member to check.
 * @returns {Promise<{success: boolean, missing: string[]}>} An object indicating success and a list of missing steps.
 */
async function checkVerificationStatus(member) {
  const db = await readDb();
  const guild = member.guild;
  const missingSteps = [];

  // --- Step 1: Agreed to rules ---
  const hasAgreedToRules = db.verificationProgress?.[member.id]?.agreedToRules === true;
  if (!hasAgreedToRules) {
    missingSteps.push('Agree to the rules in #rules.');
  }

  // --- Step 2: Read info (Not programmatically verifiable) ---

  // --- Step 3: Intro message ---
  try {
    const introChannel = guild.channels.cache.find(c => c.name === 'intros');
    if (introChannel) {
      const introMessages = await introChannel.messages.fetch({ limit: 100 });
      const hasPostedIntro = introMessages.some(m => m.author.id === member.id);
      if (!hasPostedIntro) {
        missingSteps.push('Post an introduction in #intros.');
      }
    } else {
      missingSteps.push('Could not find #intros channel.');
    }
  } catch (e) {
    console.error("Error checking intros:", e);
    missingSteps.push('Error checking for an introduction.');
  }

  // --- Step 4: Post 3 photos ---
  try {
    const photoChannel = guild.channels.cache.find(c => c.name === 'photography');
    if (photoChannel) {
      let photoCount = 0;
      const photoMessages = await photoChannel.messages.fetch({ limit: 100 });
      const userMessages = photoMessages.filter(m => m.author.id === member.id);

      for (const message of userMessages.values()) {
        for (const attachment of message.attachments.values()) {
          if (attachment.contentType?.startsWith('image/')) {
            photoCount++;
          }
        }
      }

      if (photoCount < 3) {
        missingSteps.push(`Post at least 3 photos in #photography (you have posted ${photoCount}).`);
      }
    } else {
      missingSteps.push('Could not find #photography channel.');
    }
  } catch (e) {
    console.error("Error checking photos:", e);
    missingSteps.push('Error checking for photos.');
  }

  // --- Step 5: Request membership ---
  try {
    const requestChannel = guild.channels.cache.find(c => c.name === 'request-membership');
    if (requestChannel) {
      const requestMessages = await requestChannel.messages.fetch({ limit: 50 });
      const hasRequested = requestMessages.some(m => m.author.id === member.id && m.content.includes('I understand the rules of this server'));
      if (!hasRequested) {
        missingSteps.push('Post the verification request message in #request-membership.');
      }
    } else {
      missingSteps.push('Could not find #request-membership channel.');
    }
  } catch (e) {
    console.error("Error checking request:", e);
    missingSteps.push('Error checking for membership request.');
  }

  return {
    success: missingSteps.length === 0,
    missing: missingSteps,
  };
}

module.exports = { checkVerificationStatus };