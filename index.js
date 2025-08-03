require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Bot is alive!");
});

app.listen(port, () => {
  console.log(`🌐 Web server running on port ${port}`);
});

const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

const MOD_LOG_CHANNEL_ID = '1401360940045308015'; // Replace with your mod log channel ID
const BYPASS_USER_IDS = ['333333333']; // Replace with real user IDs

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const blockedPatterns = [
  /discord\.gg\/\w+/i,
  /discord\.com\/invite\/\w+/i,
  /onlyfans\.com/i,
  /pornhub\.com/i,
  /xvideos\.com/i,
  /redtube\.com/i,
  /xnxx\.com/i,
  /sex\w*\.\w+/i,
  /nsfw/i,
];

// In-memory map to track infractions { userId: { count: number, timer: NodeJS.Timeout } }
const infractions = new Map();

const INFRACTION_LIMIT = 3;
const INFRACTION_RESET_TIME = 10 * 60 * 1000; // 10 minutes
const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // ✅ Skip moderation if the user is in the whitelist
  if (BYPASS_USER_IDS.includes(message.author.id)) return;

  const content = message.content.toLowerCase();
  const matched = blockedPatterns.find((pattern) => pattern.test(content));
  if (!matched) return;

  try {
    // Delete the message first
    await message.delete();

    // Manage infractions
    const userId = message.author.id;
    let userInfractions = infractions.get(userId);

    if (!userInfractions) {
      userInfractions = {
        count: 1,
        timer: setTimeout(() => {
          infractions.delete(userId);
        }, INFRACTION_RESET_TIME),
      };
      infractions.set(userId, userInfractions);
    } else {
      userInfractions.count++;
      clearTimeout(userInfractions.timer);
      userInfractions.timer = setTimeout(() => {
        infractions.delete(userId);
      }, INFRACTION_RESET_TIME);
    }

    const member = await message.guild.members.fetch(userId);

    // Timeout if over limit
    if (userInfractions.count >= INFRACTION_LIMIT) {
      infractions.delete(userId);
      if (member && member.moderatable) {
        await member.timeout(TIMEOUT_DURATION, 'Repeated prohibited links');
        await message.channel.send(`${member}, you have been timed out for 5 minutes due to repeated prohibited links.`);
        console.log(`⏱️ Timed out ${member.user.tag}`);
      } else {
        console.log(`❌ Cannot timeout ${message.author.tag} - missing permissions`);
      }
    } else {
      // Warn user
      await message.channel.send(`${message.author}, your message contained a prohibited link and was removed.`);
    }

    // Log to mod channel
    const modLogChannel = await client.channels.fetch(MOD_LOG_CHANNEL_ID);
    if (modLogChannel && modLogChannel.isTextBased()) {
      modLogChannel.send({
        embeds: [{
          title: '🚨 Deleted Message (Link Blocked)',
          color: 0xff0000,
          fields: [
            {
              name: 'User',
              value: `<@${message.author.id}> (${message.author.tag})`,
              inline: true,
            },
            {
              name: 'Channel',
              value: `<#${message.channel.id}>`,
              inline: true,
            },
            {
              name: 'Content',
              value: message.content.length > 1024
                ? message.content.slice(0, 1021) + '...'
                : message.content,
            },
          ],
          timestamp: new Date(),
        }],
      });
    }

    console.log(`🧹 Deleted message from ${message.author.tag}: matched ${matched}`);
  } catch (err) {
    console.error(`❌ Could not delete or timeout: ${err.message}`);
  }
});

client.login(process.env.TOKEN);
