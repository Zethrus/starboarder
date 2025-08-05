// src/features/banEvasion.js
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

/**
 * Checks a new member for signs of ban evasion, specifically a very new account age.
 * Takes action based on the server's configuration (log or ban).
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
    // Find the new admin alert channel
    const alertChannel = member.guild.channels.cache.find(channel => channel.name === config.banEvasionAlertChannelName);

    const action = config.banEvasionAction.toLowerCase();
    const reason = `Account age is ${accountAgeDays.toFixed(1)} days, which is less than the configured minimum of ${config.banEvasionMaxAccountAgeDays} days.`;
    const actionTakenText = action === 'ban' ? 'Banned' : 'Logged';

    const logEmbed = new EmbedBuilder()
      .setColor(action === 'ban' ? 0xFF0000 : 0xFFA500)
      .setTitle('🛡️ Ban Evasion System')
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .addFields(
        { name: 'User', value: `${member.user} (${member.id})`, inline: false },
        { name: 'Account Created', value: `<t:${Math.floor(accountCreationDate.getTime() / 1000)}:F>`, inline: false },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Action Taken', value: `**${actionTakenText}**`, inline: false }
      )
      .setTimestamp();

    // --- Send Admin Alert ---
    if (alertChannel) {
      const alertMessage = `@here A potential ban evader has joined: **${member.user.tag}**. Action taken: **${actionTakenText}**.`;
      await alertChannel.send({
        content: alertMessage,
        embeds: [logEmbed] // Send the same detailed embed for context
      }).catch(err => console.error(`[BAN EVASION] Failed to send alert to #${alertChannel.name}:`, err));
    }
    // ----------------------

    // --- Perform Action & Log to main log channel ---
    if (action === 'ban') {
      try {
        if (!config.enableDryRun) {
          await member.send(`You have been automatically banned from **${member.guild.name}** for suspected ban evasion (account too new).`).catch(() => { });
          await member.ban({ reason: `Ban Evasion System: ${reason}` });
        }
        console.log(`[BAN EVASION] ${config.enableDryRun ? '[DRY RUN] ' : ''}Banned new user ${member.user.tag} for being too new.`);
        if (logChannel && logChannel.id !== alertChannel?.id) {
          await logChannel.send({ embeds: [logEmbed] }); // Also log to #logs if it's a different channel
        }
      } catch (error) {
        console.error(`[BAN EVASION] Failed to ban member ${member.user.tag}:`, error);
      }
    } else { // 'log' action
      console.log(`[BAN EVASION] Flagged new user ${member.user.tag} for being too new.`);
      if (logChannel && logChannel.id !== alertChannel?.id) {
        await logChannel.send({ embeds: [logEmbed] }); // Also log to #logs if it's a different channel
      }
    }
  }
}

module.exports = handleBanEvasion;