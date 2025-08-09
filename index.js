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
const BYPASS_ROLE_IDS = ['1402069146287472710', '1386674622275125421', '1403575752011808798']; // Replace with your role IDs

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // ✅ Skip moderation if the user has any of the bypass roles
  const member = await message.guild.members.fetch(message.author.id);
  if (member.roles.cache.some(role => BYPASS_ROLE_IDS.includes(role.id))) return;

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
