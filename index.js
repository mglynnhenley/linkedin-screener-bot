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
      // C1: Check HTTP status code
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: Failed to download file`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      // C1: Handle response stream errors
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSV(csvContent) {
  // I1: Check if CSV is completely empty
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error('CSV file is empty');
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  // I1: Validate LinkedIn Profile column exists using 'in' operator
  if (records.length === 0 || !('LinkedIn Profile' in records[0])) {
    throw new Error('CSV must contain "LinkedIn Profile" column');
  }

  // Extract LinkedIn URLs
  const urls = records
    .map(row => row['LinkedIn Profile'])
    .filter(url => url && url.trim().length > 0);

  // I1: Check if there are no valid URLs after filtering
  if (urls.length === 0) {
    throw new Error('No valid LinkedIn URLs found in CSV');
  }

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
    // I2: Check if channel_id exists before posting error message
    if (event.channel_id) {
      try {
        await client.chat.postMessage({
          channel: event.channel_id,
          text: `❌ Error: ${error.message}`,
        });
      } catch (postError) {
        console.error('Failed to post error message to Slack:', postError);
      }
    }
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();
