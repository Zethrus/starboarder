// src/features/banEvasion.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

/**
 * Checks a new member for signs of ban evasion using a suspicion score system.
 * Takes action if the member's score meets or exceeds the configured threshold.
 * @param {import('discord.js').GuildMember} member The member who just joined the server.
 */
async function handleBanEvasion(member) {
  if (!config.enableBanEvasion) {
    return;
  }

  // --- Suspicion Score Calculation ---
  let suspicionScore = 0;
  const suspiciousReasons = [];

  // 1. Check Account Age
  const accountCreationDate = member.user.createdAt;
  const accountAgeDays = (new Date() - accountCreationDate) / (1000 * 3600 * 24);
  if (accountAgeDays < config.banEvasionNewAccountDays) {
    suspicionScore += config.banEvasionPointsNewAccount;
    suspiciousReasons.push(`**+${config.banEvasionPointsNewAccount} pts:** Account is only ${accountAgeDays.toFixed(1)} days old.`);
  }

  // 2. Check for Default Avatar
  if (member.user.avatar === null) {
    suspicionScore += config.banEvasionPointsDefaultAvatar;
    suspiciousReasons.push(`**+${config.banEvasionPointsDefaultAvatar} pts:** User has a default Discord avatar.`);
  }
  // ---

  // --- Take Action if Threshold is Met ---
  if (suspicionScore >= config.banEvasionSuspicionThreshold) {
    const logChannel = member.guild.channels.cache.find(channel => channel.name === config.logChannelName);
    const alertChannel = member.guild.channels.cache.find(channel => channel.name === config.banEvasionAlertChannelName);

    const action = config.banEvasionAction.toLowerCase();
    const reasonText = suspiciousReasons.join('\n');
    const actionTakenText = action === 'ban' ? 'Automatically Banned' : 'Logged';

    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId(`evasion_ban:${member.id}`).setLabel('Ban User').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
        new ButtonBuilder().setCustomId('evasion_ignore').setLabel('Ignore this alert').setStyle(ButtonStyle.Secondary)
      );

    const logEmbed = new EmbedBuilder()
      .setColor(action === 'ban' ? 0xFF0000 : 0xFFA500)
      .setTitle('🛡️ Ban Evasion System')
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setDescription(`**Suspicion Score: ${suspicionScore}** (Threshold: ${config.banEvasionSuspicionThreshold})`)
      .addFields(
        { name: 'User', value: `${member.user} (${member.id})`, inline: false },
        { name: 'Suspicious Traits', value: reasonText, inline: false },
        { name: 'Initial Action', value: `**${actionTakenText}**`, inline: false }
      )
      .setTimestamp();

    if (alertChannel) {
      const components = (action !== 'ban') ? [actionRow] : [];
      await alertChannel.send({
        content: `@here A suspicious user has joined: **${member.user.tag}**. Please review.`,
        embeds: [logEmbed],
        components: components
      }).catch(err => console.error(`[BAN EVASION] Failed to send alert to #${alertChannel.name}:`, err));
    }

    if (action === 'ban') {
      try {
        if (!config.enableDryRun) {
          await member.send(`You have been automatically banned from **${member.guild.name}** for suspected ban evasion.`).catch(() => { });
          await member.ban({ reason: `Ban Evasion System: Suspicion score of ${suspicionScore}.` });
        }
        if (logChannel && logChannel.id !== alertChannel?.id) await logChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error(`[BAN EVASION] Failed to ban member ${member.user.tag}:`, error);
      }
    } else {
      if (logChannel && logChannel.id !== alertChannel?.id) await logChannel.send({ embeds: [logEmbed] });
    }
  }
}

module.exports = handleBanEvasion;