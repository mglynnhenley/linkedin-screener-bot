import { App } from '@slack/bolt';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import https from 'https';

dotenv.config();

async function downloadFile(url, token) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  // Validate LinkedIn Profile column exists
  if (records.length === 0 || !records[0]['LinkedIn Profile']) {
    throw new Error('CSV must contain "LinkedIn Profile" column');
  }

  // Extract LinkedIn URLs
  const urls = records
    .map(row => row['LinkedIn Profile'])
    .filter(url => url && url.trim().length > 0);

  return urls;
}

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
    // Validate channel_id
    if (!event.channel_id) {
      console.error('Missing channel_id in file_shared event:', event);
      return;
    }

    // Get file info
    const fileInfo = await client.files.info({
      file: event.file_id,
    });

    const file = fileInfo.file;

    // Only process CSV files
    if (!file.name.toLowerCase().endsWith('.csv')) {
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

    // Download and parse CSV
    const csvContent = await downloadFile(file.url_private, process.env.SLACK_BOT_TOKEN);
    const linkedinUrls = parseCSV(csvContent);

    await client.chat.postMessage({
      channel: event.channel_id,
      text: `Found ${linkedinUrls.length} LinkedIn profiles. Processing...`,
    });

    console.log('LinkedIn URLs:', linkedinUrls);

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
