// src/commands/setup-verification.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readDb, writeDb } = require('../utils/helpers');
const config = require('../../config');

// Text content transcribed from the provided images
const rulesContent = {
  title: "Urbex Alberta Server Rules",
  conduct: [
    "Treat all members with respect, **don't be a sshole.**",
    "Racism, Homophobia, Sexism, and any other form of discriminatory behaviour is **prohibited**.",
    "Promotion of Terrorism or Extremism is **prohibited**.",
    "Raiding/Raid threats will result in a **immediate ban**.",
    "Use of slurs, in any context, is **strictly prohibited** from being used in this server.",
    "You must be above the **age of 16** to be in this server.",
    "Doxxing an individual will result in a **immediate ban**. Anonymity is strongly recommended for everyone.",
    "Please keep your profile picture/name appropriate.",
    "Location begging is **strictly prohibited**, do not ask for locations."
  ],
  content: [
    "No **revealing locations**, photography is allowed, however details about the whereabouts of the location, or relevant name, is **strictly prohibited**.",
    "Do not spam or flood the chat with text walls.",
    "Do not post NSFW/NSFL content anywhere in this server, **we do not want to see gore or porn**.",
    "Please post correct content in the correct channels.",
    "Depictions of your own deliberate vandalism, arson, or other acts of damage to sites, spots, or anywhere else, are **prohibited and will result in a ban**.",
    "Careless talk costs spots, **do not 'burn' locations**.",
    "All posts relating to urbex should have a level of maturity, don't be a idiot.",
    "Posts mentioning or containing the use or recommendation of tools are **strictly prohibited**."
  ],
  notes: [
    "It is the members responsibility that if they notice any form of these rules being broken, or a concern to which the rules are being broken, to **immediately inform a member of staff**.",
    "It is up to the discretion of the staff team to enforce these rules. This prohibits any **\"loopholes\"** as anything that can be considered to violate these rules will be enforced as to the above. If you believe you have been wrongly punished, you may contact an administrator.",
    "Punishments may range from warns, mutes, server probation, server blacklist, or a complete removal from the server, whether permanent or temporary. The severity will be determined by the staff member, and will fall into the same policy under Note 2."
  ],
  footer: "Server rules last updated on 24-03-2025"
};

const verificationContent = {
  title: "Welcome to Urbex Alberta",
  description: "The server works on a system of tiered membership. Right now by seeing this message you are a @Unverified Member, this not only limits your access to the server (deliberately for the safety of the community) but also ensures that you're not here to cause problems within the server itself. This also intends to prove that you have interest within this server.",
  steps: [
    "**Step 1**. Read the server rules in #rules.",
    "**Step 2**. Read the details about information and resources in. #information and #resources.",
    "**Step 3**. Send a intro about yourself, to give others a brief understanding of why you're interested in Urbex in #intros.",
    "**Step 4**. Post a minimum of 3 photos in #photography of something directly relating to urbex that you have done.",
    "**Step 5**. Follow the instructions in the following embed to request membership."
  ],
  complications: "If you have any complications, don't feel afraid to reach out in #noob-chat",
  notWelcome: [
    "Vandals, graffiti artists, taggers, scrappers, arsonists, undercover cops looking to bust local people interested in architectural history",
    "Those who don't follow the server rules",
    "Those who have been blacklisted or previously banned.",
    "Unapproved Alt Accounts",
    "Lurkers"
  ],
  afterApply: "If you meet the criteria, congrats! you can apply to be a server member!\nIf you did apply, and were not approved for whatever reason, you'll be told why and expected to complete the tasks or face removal from the server.",
  removalWarning: "Members that have been within the server for ten (10) days without sending a singular message and do not attempt to complete the member verification will be removed.",
  requestMessage: "Members that meet this criteria can apply in #request-membership with the following message:",
  requestQuote: "I understand the rules of this server, and equally know that may be banned, blacklisted, or put on probation for violating the server rules. I equally state that I meet the criteria and have completed the tasks outlined in the how-2-member channel. @Server Staff"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verification')
    .setDescription('Sets up the rules and verification messages in their respective channels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const rulesChannelName = 'rules';
    const howToMemberChannelName = 'how-2-member';

    const rulesChannel = interaction.guild.channels.cache.find(c => c.name === rulesChannelName);
    const howToMemberChannel = interaction.guild.channels.cache.find(c => c.name === howToMemberChannelName);

    if (!rulesChannel) {
      return interaction.editReply(`Error: Channel #${rulesChannelName} not found.`);
    }
    if (!howToMemberChannel) {
      return interaction.editReply(`Error: Channel #${howToMemberChannelName} not found.`);
    }

    try {
      // --- 1. Create Rules Post ---
      const rulesEmbed = new EmbedBuilder()
        .setTitle(rulesContent.title)
        .setColor(0x5865F2)
        .addFields(
          { name: 'Conduct Rules', value: rulesContent.conduct.map((rule, i) => `**${"I".repeat(i+1)}.** ${rule}`).join('\n\n') },
          { name: 'Content Rules', value: rulesContent.content.map((rule, i) => `**${"I".repeat(i+1)}.** ${rule}`).join('\n\n') },
          { name: 'Note 1', value: rulesContent.notes[0] },
          { name: 'Note 2', value: rulesContent.notes[1] },
          { name: 'Note 3', value: rulesContent.notes[2] }
        )
        .setFooter({ text: rulesContent.footer });

      const rulesRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('rules_agree')
          .setLabel('I Agree to the Rules')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

      const rulesMessage = await rulesChannel.send({ embeds: [rulesEmbed], components: [rulesRow] });

      // --- 2. Create Verification Post ---
      const verificationEmbed1 = new EmbedBuilder()
        .setTitle(verificationContent.title)
        .setColor(0x5865F2)
        .setDescription(verificationContent.description.replace('@Unverified Member', `**Unverified Member**`))
        .addFields(
          { name: "What are the steps to get membership?", value: verificationContent.steps.join('\n') },
          { name: '\u200B', value: verificationContent.complications }
        );

      const verificationEmbed2 = new EmbedBuilder()
        .setColor(0xED4245)
        .addFields(
          { name: "Who is not welcome within this server?", value: verificationContent.notWelcome.map(item => `❌ ${item}`).join('\n') },
          { name: '\u200B', value: verificationContent.afterApply },
          { name: '\u200B', value: verificationContent.removalWarning }
        );

      const verificationEmbed3 = new EmbedBuilder()
        .setColor(0xFEE75C)
        .addFields(
          { name: verificationContent.requestMessage, value: `\`\`\`${verificationContent.requestQuote.replace('@Server Staff', '')}\`\`\`` }
        );

      const verificationMessage = await howToMemberChannel.send({ embeds: [verificationEmbed1, verificationEmbed2, verificationEmbed3] });
      await verificationMessage.react('✅');

      // --- 3. Save to DB ---
      const db = await readDb();
      db.rulesMessageId = rulesMessage.id;
      db.verificationMessageId = verificationMessage.id;
      if (!db.verificationProgress) {
        db.verificationProgress = {};
      }
      await writeDb(db);

      await interaction.editReply(`✅ Successfully set up the rules message in ${rulesChannel} and the verification message in ${howToMemberChannel}.`);

    } catch (error) {
      console.error('Failed to set up verification messages:', error);
      await interaction.editReply({ content: 'An error occurred. Please check my permissions in the target channels and try again.' });
    }
  },
};