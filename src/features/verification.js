// src/features/verification.js
const config = require('../../config');
const { readDb } = require('../utils/helpers');

const MIN_INTRO_LENGTH = 50; // Minimum characters for a valid intro

/**
 * Checks if a member has completed all verification steps.
 * @param {import('discord.js').GuildMember} member The member to check.
 * @returns {Promise<{
 * success: boolean,
 * missing: string[],
 * evidence: { introMessage: import('discord.js').Message | null, photoMessages: import('discord.js').Message[] }
 * }>} An object indicating success, a list of missing steps, and evidence messages.
 */
async function checkVerificationStatus(member) {
  const db = await readDb();
  const guild = member.guild;
  const missingSteps = [];
  const evidence = {
    introMessage: null,
    photoMessages: [],
  };

  // --- Step 1: Agreed to rules ---
  const hasAgreedToRules = db.verificationProgress?.[member.id]?.agreedToRules === true;
  if (!hasAgreedToRules) {
    missingSteps.push('Agree to the rules in #rules by clicking the button.');
  }

  // --- Step 2: Read info (Not verifiable) ---

  // --- Step 3: Intro message ---
  try {
    const introChannel = guild.channels.cache.find(c => c.name === 'intros');
    if (introChannel) {
      const introMessages = await introChannel.messages.fetch({ limit: 100 });
      // Find a message from the user that meets the minimum length
      const userIntro = introMessages.find(m => m.author.id === member.id && m.content.length >= MIN_INTRO_LENGTH);

      if (userIntro) {
        evidence.introMessage = userIntro;
      } else {
        missingSteps.push(`Post an introduction of at least ${MIN_INTRO_LENGTH} characters in #intros.`);
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
      const photoMessages = await photoChannel.messages.fetch({ limit: 100 });
      const userMessages = photoMessages.filter(m => m.author.id === member.id);

      let photoCount = 0;
      for (const message of userMessages.values()) {
        const imageAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/'));
        if (imageAttachments.size > 0) {
          // Count each attachment as one photo
          photoCount += imageAttachments.size;
          // Save the message as evidence
          evidence.photoMessages.push(message);
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

  // We don't check for step 5, as that is part of the old manual process.
  // The user reacting is the new "request for membership".

  return {
    success: missingSteps.length === 0,
    missing: missingSteps,
    evidence: evidence,
  };
}

module.exports = { checkVerificationStatus };