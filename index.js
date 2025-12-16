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

async function callRelevanceAPI(profileUrls) {
  // C1: Validate environment variable exists
  if (!process.env.RELEVANCE_API_URL) {
    throw new Error('RELEVANCE_API_URL environment variable is not set');
  }

  // I2: Validate input is a non-empty array
  if (!Array.isArray(profileUrls)) {
    throw new Error('profileUrls must be an array');
  }
  if (profileUrls.length === 0) {
    throw new Error('profileUrls array cannot be empty');
  }

  // I3: Set up network timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(process.env.RELEVANCE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_urls: profileUrls }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // C2: Try to get error details from response body
      let errorMessage = `Relevance API error: HTTP ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      } catch (textError) {
        // If we can't read the error body, continue with basic error message
      }
      throw new Error(errorMessage);
    }

    // C2: Wrap JSON parsing in try-catch
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to parse Relevance API response as JSON: ${parseError.message}`);
    }

    return data;
  } catch (error) {
    // I3: Handle timeout specifically
    if (error.name === 'AbortError') {
      throw new Error('Relevance API request timed out after 30 seconds');
    }
    throw error;
  } finally {
    // I3: Clear timeout in finally block
    clearTimeout(timeoutId);
  }
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

    // Enrich profiles with Relevance API
    const enrichedProfiles = await callRelevanceAPI(linkedinUrls);

    console.log('Enriched profiles:', enrichedProfiles);

    await client.chat.postMessage({
      channel: event.channel_id,
      text: '🤖 Profiles enriched. Now rating with AI...',
    });

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
