# LinkedIn Profile Screener Slack Bot

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your tokens:
   ```bash
   cp .env.example .env
   ```

3. Configure Slack App:
   - Create new Slack app at https://api.slack.com/apps
   - Enable Socket Mode (Settings > Socket Mode)
   - Add Bot Token Scopes: `files:read`, `chat:write`, `app_mentions:read`
   - Install app to workspace
   - Copy Bot Token and App Token to `.env`

4. Run the bot:
   ```bash
   node index.js
   ```

## Usage

1. DM the bot in Slack
2. Upload a CSV file with "LinkedIn Profile" column
3. Bot will process profiles and return ranked results
