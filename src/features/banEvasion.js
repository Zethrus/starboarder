// src/features/banEvasion.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

/**
 * Checks a new member for signs of ban evasion and sends an alert with action buttons.
 * @param {import('discord.js').GuildMember} member The member who just joined the server.
 */
async function handleBanEvasion(member) {
  if (!config.enableBanEvasion) {
    return;
  }

  const accountCreationDate = member.user.createdAt;
  const accountAgeDays = (new Date() - accountCreationDate) / (1000 * 3600 * 24);

  if (accountAgeDays < config.banEvasionMaxAccountAgeDays) {
    const logChannel = member.guild.channels.cache.find(channel => channel.name === config.logChannelName);
    const alertChannel = member.guild.channels.cache.find(channel => channel.name === config.banEvasionAlertChannelName);

    const action = config.banEvasionAction.toLowerCase();
    const reason = `Account age is ${accountAgeDays.toFixed(1)} days, which is less than the configured minimum of ${config.banEvasionMaxAccountAgeDays} days.`;
    const actionTakenText = action === 'ban' ? 'Automatically Banned' : 'Logged';

    // --- Create Interactive Buttons ---
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`evasion_ban:${member.id}`) // Pass the user's ID in the customId
          .setLabel('Ban User')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔨'),
        new ButtonBuilder()
          .setCustomId('evasion_ignore')
          .setLabel('Ignore this alert')
          .setStyle(ButtonStyle.Secondary)
      );
    // --------------------------------

    const logEmbed = new EmbedBuilder()
      .setColor(action === 'ban' ? 0xFF0000 : 0xFFA500)
      .setTitle('🛡️ Ban Evasion System')
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: 'User', value: `${member.user} (${member.id})`, inline: false },
        { name: 'Account Created', value: `<t:${Math.floor(accountCreationDate.getTime() / 1000)}:F>`, inline: false },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Initial Action', value: `**${actionTakenText}**`, inline: false }
      )
      .setTimestamp();

    // --- Send Alert to Admin Channel ---
    if (alertChannel) {
      // Only show buttons if the initial action was NOT a ban
      const components = (action !== 'ban') ? [actionRow] : [];
      await alertChannel.send({
        content: `@here A potential ban evader has joined: **${member.user.tag}**. Please review.`,
        embeds: [logEmbed],
        components: components
      }).catch(err => console.error(`[BAN EVASION] Failed to send alert to #${alertChannel.name}:`, err));
    }
    // ---------------------------------

    // --- Perform Initial Action & Log to main log channel ---
    if (action === 'ban') {
      try {
        if (!config.enableDryRun) {
          await member.send(`You have been automatically banned from **${member.guild.name}** for suspected ban evasion (account too new).`).catch(() => { });
          await member.ban({ reason: `Ban Evasion System: ${reason}` });
        }
        if (logChannel && logChannel.id !== alertChannel?.id) {
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (error) {
        console.error(`[BAN EVASION] Failed to ban member ${member.user.tag}:`, error);
      }
    } else { // 'log' action
      if (logChannel && logChannel.id !== alertChannel?.id) {
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  }
}

module.exports = handleBanEvasion;