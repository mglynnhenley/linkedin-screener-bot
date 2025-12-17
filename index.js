import { App } from '@slack/bolt';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import https from 'https';
import fs from 'fs';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RATING_BATCH_SIZE = 30;

// C1: Validate OPENAI_API_KEY exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

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

  if (records.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  // Auto-detect column containing LinkedIn URLs
  const headers = Object.keys(records[0]);
  let linkedinColumn = null;

  for (const header of headers) {
    // Check if any row in this column contains "linkedin.com"
    const hasLinkedInUrl = records.some(row => {
      const value = (row[header] || '').toString().toLowerCase();
      return value.includes('linkedin.com');
    });

    if (hasLinkedInUrl) {
      linkedinColumn = header;
      console.log(`[TRACE] Auto-detected LinkedIn column: "${linkedinColumn}"`);
      break;
    }
  }

  if (!linkedinColumn) {
    throw new Error('No column containing LinkedIn URLs found. Please ensure your CSV has LinkedIn profile links.');
  }

  const seen = new Set();

  const urls = records
    .map(row => (row[linkedinColumn] || '').trim())
    .filter(url => url.length > 0)
    .filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  if (urls.length === 0) {
    throw new Error('No LinkedIn URLs found in CSV after dedup');
  }

  return urls;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function callRelevanceAPI(profileUrls) {
  console.log(`[TRACE] Relevance API: sending ${profileUrls.length} profile URLs`);
  if (!process.env.RELEVANCE_API_URL) {
    throw new Error('RELEVANCE_API_URL environment variable is not set');
  }
  if (!Array.isArray(profileUrls) || profileUrls.length === 0) {
    throw new Error('profileUrls must be a non-empty array');
  }

  const batches = chunkArray(profileUrls, 50);
  const combinedProfiles = [];

  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    const batchLabel = `${idx + 1}/${batches.length}`;
    console.log(`[TRACE] Relevance API batch ${batchLabel}: sending ${batch.length}`);

    const response = await fetch(process.env.RELEVANCE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_urls: batch }),
    });

    console.log(`[TRACE] Relevance API batch ${batchLabel}: response ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const extra = errorBody ? ` - ${errorBody}` : '';
      throw new Error(`Relevance API error (batch ${batchLabel}): HTTP ${response.status} ${response.statusText}${extra}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to parse Relevance API response (batch ${batchLabel}) as JSON: ${parseError.message}`);
    }

    const batchProfiles = Array.isArray(data?.profiles)
      ? data.profiles
      : Array.isArray(data)
        ? data
        : [];

    console.log(`[TRACE] Relevance API batch ${batchLabel}: profiles returned ${batchProfiles.length}`);
    combinedProfiles.push(...batchProfiles);
  }

  console.log(`[TRACE] Relevance API combined profiles: ${combinedProfiles.length}`);
  return { profiles: combinedProfiles };
}

async function rateProfile(profileData, linkedinUrl) {
  // I1: Validate input parameters
  if (!profileData) {
    throw new Error('profileData is required');
  }
  if (!linkedinUrl || typeof linkedinUrl !== 'string') {
    throw new Error('linkedinUrl must be a non-empty string');
  }

  // I4: Truncate profile data to avoid token limits
  let profileDataStr = JSON.stringify(profileData, null, 2);

  const system = `You are an expert talent evaluator for Merantix Capital, a pre-seed VC and incubator.
Your goal is to identify exceptional founder potential by recognizing patterns and evaluating what makes someone interesting.

Stay objective: LinkedIn profiles are self-written. Trust verifiable facts (companies, titles, dates, education) over claims like "expert in" or "passionate about."

Use the full 1-10 scale. Most profiles are 4-6. Reserve 8+ for truly exceptional candidates.`;

  const user = `Evaluate this LinkedIn profile for founder potential (1-10 scale).

## Core question:
Would this person be interesting to meet? What makes them unusual or exceptional?

## Look for strong patterns:

**Experience patterns:**
- Deep tenure at quality companies (2-4+ years shows real depth)
- Scale operators: led teams, shipped to millions, built infrastructure
- Domain experts: deep knowledge in specific verticals (fintech, security, healthtech, etc.)
- Big tech → startup trajectory (learned at scale, now building)
- Early team members who rode through growth stages
- Non-technical founding paths: Founding Associate, Chief of Staff, first hire (sales/ops/GTM) at top university + startup

**Availability signals (IMPORTANT):**
- Just left a good job (0-3 months) = EXCELLENT signal
- Recently started in stealth (0-6 months) = STRONG signal, very available
- Building solo 6-12 months = GOOD signal, might need co-founder/support
- Been at same company 18+ months = NOT available for incubation (penalty)

**Wildcard traits (boost score):**
- Early hustle: started business in college, built something with traction young, won competitions
- Unconventional: art/music → tech, PhD dropout → founder, military → startup
- Athletic: Olympic athlete, national team, D1 sports (shows discipline, peak performance)

**Education:**
- Top universities (Stanford, MIT, Oxbridge, etc.) add credibility throughout career
- Especially important early career

## How to evaluate evidence:

**What LinkedIn actually shows:**
- Company names, job titles, dates (TRUST THESE - verifiable facts)
- Team size, project scope, geographic reach (use when present)
- Role descriptions like "rebuilt payments infrastructure" or "early team through Series B"
- Education, certifications, languages
- Sometimes: awards, publications, conference speaking

**What LinkedIn rarely shows:**
- Revenue, funding, retention metrics
- Detailed traction numbers
- Exit outcomes

→ Use what's there. Don't penalize absence of metrics that wouldn't be on LinkedIn anyway.

**Stay objective with self-written content:**
- Verifiable facts (company, title, dates) > specific projects > external validation > vague claims
- Discount generic fluff: "expert in", "passionate about", "skilled at"
- Value specific: "Built X that did Y" shows they can articulate their work

## Calibration by career stage:
- Junior (0-2 years): HIGH bar - need top university OR startup experience OR wildcard trait
- Mid (3-6 years): Should show progression, domain depth, building track record
- Senior (7+ years): Expect deep expertise, leadership, proof of impact

## Scoring guidance - USE THE FULL RANGE:

- 10: Dream candidate. Deep domain expert + clear builder + available now + wildcard trait. Would be excited to meet immediately.
- 9: Exceptional. Strong on most dimensions, one standout quality. Clear "yes, let's talk."
- 8: Very strong. Multiple positives, would definitely take a meeting.
- 7: Good candidate. Clear strengths in 1-2 areas, worth exploring.
- 6: Interesting but needs more. One good signal but rest is unclear or generic.
- 5: Okay foundation. Decent background but nothing that stands out yet. Maybe in a few years.
- 4: Weak signals. Generic background, limited building evidence. Junior at average company, no wildcards.
- 3: Poor fit. Wrong profile for early-stage founding. Long corporate career, no ownership, or very early with no signals.
- 2: Red flags. Currently unavailable (long-term CEO), no relevant experience, or concerning patterns.
- 1: Not relevant. Completely wrong profile (sales-only with no product exposure, pure academic, etc.)

**Be bold with scores:** Don't cluster in 5-7. If someone is interesting, give them 8+. If they're generic, give them 3-4.

## How to write your reasoning:

**Format: 2-3 sentences, focus on strengths only**

Structure:
1. What pattern do they match? (cite verifiable facts: company, role, tenure)
2. Why are they interesting? (domain, scale, wildcards, availability)
3. NO "what's missing" or "would be stronger if..." - just explain the score with what IS there

**Good examples:**

Rating 10: "8 years building ML infrastructure at scale-ups, led 15-person team through Series B→C, left 2 months ago. Former Olympic swimmer. Now in stealth AI infra startup (4 months). Deep technical + proven leadership + wildcard + perfect timing."

Rating 9: "Serial founder with exit (sold B2B SaaS after 4 years). Now 3 months into stealth AI startup, previously led GTM at SaaS company through Series C. Proven execution in hot domain."

Rating 8: "10 years infrastructure eng at payment companies (senior level, led reliability at scale). Left 2 months ago, no current role. Deep fintech expertise plus clear availability."

Rating 8: "Founding Associate at top-tier VC-backed startup (3 years, pre-seed→Series A), then Chief of Staff at scale-up. Oxford grad. Left 1 month ago. Saw 0→1 up close, strong university, clear availability."

Rating 7: "Early employee at design tool startup (#8, through Series B), now founding similar company (6 months in). Clear builder trajectory but early stage."

Rating 7: "First sales hire at B2B SaaS (grew team 1→10, $0→$5M ARR over 3 years). Strong university. Currently employed but good GTM + hustle signal."

Rating 6: "Mid-level PM at tech company (3 years) across multiple product areas. Solid tenure but no clear domain spike or standout signal."

Rating 5: "Junior engineer at established company (18 months), good university. Decent foundation but nothing exceptional yet - needs more time."

Rating 4: "Recent grad with 1 year at consulting firm. No startup exposure, no building evidence, standard path with no wildcards."

Rating 3: "15 years in corporate IT roles, no product building. Wrong profile for founding - more suited to enterprise operations."

Rating 2: "Currently CEO of same company for 4 years. Not available for incubation."

Rating 1: "Pure sales background with no product/technical exposure, no top university, no startup experience. Not relevant for technical founding."

**Remember:**
- Cite verifiable facts (company type, role level, years)
- Focus on patterns not brand names: "senior at fintech scale-up" > "senior at Stripe"
- Explain what makes them interesting for incubation
- Stay objective - it's their self-written profile
- Don't mention gaps or missing info
- If score is low, explain why based on what IS there (or isn't)

Profile data:
${profileDataStr}

Return JSON with:
- rating: integer 1-10
- reasoning: 2-3 sentences explaining your score. Cite specific evidence.`;
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rating_response",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            rating: { type: "integer", minimum: 1, maximum: 10 },
            reasoning: { type: "string", maxLength: 800 }
          },
          required: ["rating", "reasoning"]
        },
        strict: true
      }
    }
  });

  // Extract structured JSON directly
  const rawContent = response?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI API returned an empty response.');
  }

  let result;
  try {
    result = JSON.parse(rawContent);
  } catch (parseError) {
    throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}. Raw content: ${rawContent}`);
  }

  // Minimal sanity check
  if (typeof result.rating !== 'number' || typeof result.reasoning !== 'string') {
    throw new Error(`OpenAI response missing required fields. Raw content: ${rawContent}`);
  }

  return {
    linkedinUrl,
    rating: result.rating,
    reasoning: result.reasoning,
  };
}

async function rateAllProfiles(enrichedProfiles, linkedinUrls) {
  // I1: Validate input parameters
  if (!enrichedProfiles) {
    throw new Error('enrichedProfiles is required');
  }
  if (!Array.isArray(linkedinUrls)) {
    throw new Error('linkedinUrls must be an array');
  }

  const ratings = [];

  // Ensure we always have an array of profiles (API returns under `profiles`)
  const profiles = Array.isArray(enrichedProfiles?.profiles)
    ? enrichedProfiles.profiles
    : Array.isArray(enrichedProfiles)
      ? enrichedProfiles
      : [];

  console.log(`[TRACE] Enriched profiles received: ${profiles.length}, input URLs: ${linkedinUrls.length}`);

  // I2: Warn if array lengths don't match
  if (profiles.length !== linkedinUrls.length) {
    console.warn(`Warning: profiles.length (${profiles.length}) !== linkedinUrls.length (${linkedinUrls.length})`);
  }

  // I2: Use Math.min to avoid undefined access
  const maxIndex = Math.min(profiles.length, linkedinUrls.length);
  const indexBatches = chunkArray([...Array(maxIndex).keys()], RATING_BATCH_SIZE);

  for (let b = 0; b < indexBatches.length; b++) {
    const batch = indexBatches[b];
    console.log(`[TRACE] Rating batch ${b + 1}/${indexBatches.length}: size=${batch.length}`);

    for (const idx of batch) {
      const url = linkedinUrls[idx];
      const profile = profiles[idx];
      try {
        const rating = await rateProfile(profile, url);
        ratings.push(rating);
      } catch (error) {
        console.error(`Error rating profile ${url}:`, error);
        ratings.push({
          linkedinUrl: url,
          rating: 0,
          reasoning: `Error: ${error.message}`,
        });
      }
    }
  }

  const sorted = ratings.sort((a, b) => b.rating - a.rating);
  console.log(`[TRACE] Ratings produced: ${sorted.length}`);
  return sorted;
}

function createResultsCSV(ratings) {
  // I3: Validate ratings is non-empty array
  if (!Array.isArray(ratings)) {
    throw new Error('ratings must be an array');
  }
  if (ratings.length === 0) {
    throw new Error('ratings array cannot be empty');
  }

  const csv = stringify(ratings, {
    header: true,
    columns: [
      { key: 'linkedinUrl', header: 'LinkedIn URL' },
      { key: 'rating', header: 'Rating' },
      { key: 'reasoning', header: 'Reasoning' },
    ],
  });

  // Save to temp file
  const filename = `results-${Date.now()}.csv`;

  // I1: Wrap fs.writeFileSync in try-catch
  try {
    fs.writeFileSync(filename, csv);
  } catch (error) {
    throw new Error(`Failed to create results CSV file: ${error.message}`);
  }

  return filename;
}

function createSummaryMessage(ratings, duration) {
  // I3: Validate ratings is non-empty array
  if (!Array.isArray(ratings)) {
    throw new Error('ratings must be an array');
  }
  if (ratings.length === 0) {
    throw new Error('ratings array cannot be empty');
  }

  // Format duration nicely
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  return `✅ Complete! There are a bunch of cool candidates - take a look at the CSV to see who I think you should reach out to.`;
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

    // Get bot's user ID and skip if file was uploaded by the bot itself
    const authResult = await client.auth.test();
    if (file.user === authResult.user_id) {
      console.log('[TRACE] Skipping file uploaded by bot itself');
      return;
    }

    // Get the message timestamp for threading
    // The file shares contain the message ts where the file was shared
    const shares = file.shares?.private || file.shares?.public || {};
    const channelShares = shares[event.channel_id] || [];
    const thread_ts = channelShares[0]?.ts || null;

    // Only process CSV files
    if (!file.name.toLowerCase().endsWith('.csv')) {
      await client.chat.postMessage({
        channel: event.channel_id,
        thread_ts: thread_ts,
        text: '❌ Please upload a CSV file.',
      });
      return;
    }

    // Track start time
    const startTime = Date.now();

    // Download and parse CSV (includes validation and dedup)
    const csvContent = await downloadFile(file.url_private, process.env.SLACK_BOT_TOKEN);
    const linkedinUrls = parseCSV(csvContent);

    // Send acknowledgment with profile count
    await client.chat.postMessage({
      channel: event.channel_id,
      thread_ts: thread_ts,
      text: `👋 Thanks for sharing the list of attendees! Let me see if there are any cool candidates we could incubate at Merantix Capital.\n\nFound ${linkedinUrls.length} LinkedIn profiles to screen...`,
    });

    console.log('LinkedIn URLs:', linkedinUrls);

    // Enrich profiles with Relevance API
    await client.chat.postMessage({
      channel: event.channel_id,
      thread_ts: thread_ts,
      text: `🌐 Enriching profiles... (may take 1-2 minutes for large lists)`,
    });

    const enrichedProfiles = await callRelevanceAPI(linkedinUrls);

    console.log("ENRICHED PROFILES: ", enrichedProfiles);

    // Ensure we have profiles before proceeding
    const profiles = Array.isArray(enrichedProfiles?.profiles)
      ? enrichedProfiles.profiles
      : Array.isArray(enrichedProfiles)
        ? enrichedProfiles
        : [];

    if (profiles.length === 0) {
      throw new Error('Relevance API returned no profiles; aborting.');
    }

    await client.chat.postMessage({
      channel: event.channel_id,
      thread_ts: thread_ts,
      text: '🤖 Rating profiles with AI...',
    });

    // Rate profiles with OpenAI
    const ratings = await rateAllProfiles(enrichedProfiles, linkedinUrls);

    console.log('Ratings:', ratings);

    // Calculate duration
    const duration = (Date.now() - startTime) / 1000; // in seconds

    // Create results CSV
    const resultsFile = createResultsCSV(ratings);

    // Create output filename: attendees-screened-{originalname}.csv
    const outputFilename = `attendees-screened-${file.name}`;

    // I2: Wrap results sending in try-finally to ensure temp file cleanup
    try {
      // Send summary message
      const summary = createSummaryMessage(ratings, duration);
      await client.chat.postMessage({
        channel: event.channel_id,
        thread_ts: thread_ts,
        text: summary,
      });

      // Upload results file
      await client.files.uploadV2({
        channel_id: event.channel_id,
        thread_ts: thread_ts,
        file: fs.createReadStream(resultsFile),
        filename: outputFilename,
      });
    } finally {
      // I2: Cleanup temp file with its own try-catch
      try {
        fs.unlinkSync(resultsFile);
      } catch (unlinkError) {
        console.error('Failed to delete temporary file:', unlinkError);
      }
    }

  } catch (error) {
    console.error('Error handling file:', error);
    // I2: Check if channel_id exists before posting error message
    if (event.channel_id) {
      try {
        // Try to get thread_ts if available in scope
        const errorThreadTs = typeof thread_ts !== 'undefined' ? thread_ts : null;
        await client.chat.postMessage({
          channel: event.channel_id,
          thread_ts: errorThreadTs,
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
