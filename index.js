import { App } from '@slack/bolt';
import dotenv from 'dotenv';

dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// Test that bot starts
app.message('hello', async ({ message, say }) => {
  await say(`Hello <@${message.user}>! I'm ready to screen LinkedIn profiles.`);
});

// File upload handler
app.event('file_shared', async ({ event, client }) => {
  try {
    // Get file info
    const fileInfo = await client.files.info({
      file: event.file_id,
    });

    const file = fileInfo.file;

    // Only process CSV files
    if (!file.name.endsWith('.csv')) {
      await client.chat.postMessage({
        channel: event.channel_id,
        text: '❌ Please upload a CSV file.',
      });
      return;
    }

    // Send acknowledgment
    await client.chat.postMessage({
      channel: event.channel_id,
      text: `📊 Processing ${file.name}...`,
    });

    console.log('Received CSV file:', file.name);

  } catch (error) {
    console.error('Error handling file:', error);
    await client.chat.postMessage({
      channel: event.channel_id,
      text: `❌ Error: ${error.message}`,
    });
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();
