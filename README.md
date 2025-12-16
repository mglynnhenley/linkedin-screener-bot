# LinkedIn Profile Screener Slack Bot

Automatically screen LinkedIn profiles for founder/incubation potential using AI.

## Features

- Upload CSV with LinkedIn profiles via Slack DM
- Enriches profiles using Relevance.ai API
- Rates candidates 1-10 using OpenAI GPT-4
- Returns sorted results with reasoning

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Slack App

1. Go to https://api.slack.com/apps and create new app
2. Enable Socket Mode (Settings > Socket Mode)
3. Create App-Level Token with `connections:write` scope
4. Add Bot Token Scopes:
   - `files:read`
   - `chat:write`
   - `app_mentions:read`
5. Subscribe to Bot Events:
   - `file_shared`
   - `message.im`
6. Install app to workspace

### 3. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env` with:
- `SLACK_BOT_TOKEN` - From "OAuth & Permissions"
- `SLACK_APP_TOKEN` - App-level token from step 2.3
- `OPENAI_API_KEY` - Your OpenAI API key
- `RELEVANCE_API_URL` - Already configured

### 4. Run Bot

```bash
npm start
```

## Usage

1. Open DM with bot in Slack
2. Upload CSV file with "LinkedIn Profile" column
3. Wait for processing (shows progress messages)
4. Receive:
   - Summary message with top 5 candidates
   - Full results CSV file

## CSV Format

Your CSV must include a column named "LinkedIn Profile":

```csv
Name,Email,LinkedIn Profile
John Doe,john@example.com,https://linkedin.com/in/johndoe
Jane Smith,jane@example.com,https://linkedin.com/in/janesmith
```

## Rating Criteria

Profiles are rated 1-10 based on:
- Experience at top-tier companies (FAANG, unicorns)
- Startup/founding experience
- Education at top universities
- Technical background (engineering, product)
- Leadership roles
- Entrepreneurial indicators
