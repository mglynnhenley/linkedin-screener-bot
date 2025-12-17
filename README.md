# LinkedIn Profile Screener Slack Bot

AI-powered LinkedIn profile screening bot that evaluates founder potential for pre-seed VC and incubator programs. Upload a CSV of LinkedIn profiles to Slack, and get back ranked candidates with detailed AI evaluations.

## What It Does

1. You upload a CSV with LinkedIn profile URLs to Slack
2. Bot enriches profiles via Relevance AI (scrapes LinkedIn data)
3. Bot rates each profile 1-10 using OpenAI GPT-4
4. You get back a summary + full results CSV in the same Slack thread

---

## Step-by-Step Setup Guide

Follow these steps **in order** to get the bot running:

### Step 1: Set Up Relevance AI (LinkedIn Profile Scraper)

Relevance AI scrapes and enriches LinkedIn profiles.

#### 1.1 Create Account
1. Go to **https://relevanceai.com**
2. Click **"Sign Up"** or **"Get Started"**
3. Create an account with your email

#### 1.2 Add Credits
1. Go to **Billing** or **Credits** in your dashboard
2. Purchase credits (start with $10-20 for testing)
   - Scraping costs ~$0.01-0.02 per profile

#### 1.3 Set Up LinkedIn Profile Scraper
1. In Relevance AI dashboard, go to **"Tools"** or **"Workflows"**
2. Search for **"LinkedIn Profile Scraper"** template
3. Create a new workflow from the template
4. Configure it to accept:
   - **Input**: Array of LinkedIn profile URLs
   - **Output**: Profile data (experience, education, etc.)
5. **Test** with a sample LinkedIn URL to verify it works
6. **Deploy** the workflow to get an API endpoint

#### 1.4 Get API Endpoint URL
1. After deploying, copy the **API endpoint URL**
2. Save it - you'll need this as `RELEVANCE_API_URL`
3. Example format: `https://api-<region>.stack.tryrelevance.com/latest/studios/<studio-id>/trigger_limited`

**Note the endpoint format** - it should accept:
```json
POST /your-endpoint
{
  "profile_urls": ["https://linkedin.com/in/username", ...]
}
```

---

### Step 2: Set Up OpenAI (GPT-4 Access)

OpenAI's GPT-4 evaluates each profile.

#### 2.1 Create Account
1. Go to **https://platform.openai.com/signup**
2. Sign up with your email
3. Verify your email address

#### 2.2 Add Credits
1. Go to **https://platform.openai.com/account/billing**
2. Click **"Add payment method"**
3. Add a credit/debit card
4. Add at least **$10 in credits** (can set up auto-recharge)
   - Cost: ~$0.01-0.05 per profile evaluation

#### 2.3 Get API Key
1. Go to **https://platform.openai.com/api-keys**
2. Click **"Create new secret key"**
3. Give it a name (e.g., "LinkedIn Bot")
4. **Copy the key** (starts with `sk-`)
   - ⚠️ **Save this immediately** - you won't see it again!
5. Save it as `OPENAI_API_KEY`

#### 2.4 Verify Access
- Your account needs access to GPT-4 models
- If you're a new user, you may need to add credits first
- The bot uses the `gpt-4o` model (latest GPT-4)

---

### Step 3: Configure Slack Bot

#### 3.1 Create Slack App
1. Go to **https://app.slack.com/apps-manage/**
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter app name: `LinkedIn Screener Bot`
5. Select your workspace
6. Click **"Create App"**

#### 3.2 Enable Socket Mode
1. In the left sidebar, go to **Settings → Socket Mode**
2. Toggle **"Enable Socket Mode"** to **ON**
3. A modal appears - enter token name: `socket-token`
4. Click **"Generate"**
5. **Copy the token** (starts with `xapp-`)
   - Save this as `SLACK_APP_TOKEN`
6. Click **"Done"**

#### 3.3 Add Bot Permissions
1. In the left sidebar, go to **Features → OAuth & Permissions**
2. Scroll down to **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add these three:
   - `files:read` - Let bot read uploaded files
   - `chat:write` - Let bot post messages
   - `app_mentions:read` - Let bot see when mentioned

#### 3.4 Install to Workspace
1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`)
   - Save this as `SLACK_BOT_TOKEN`

#### 3.5 Enable Events
1. In the left sidebar, go to **Features → Event Subscriptions**
2. Toggle **"Enable Events"** to **ON**
3. Under **"Subscribe to bot events"**, click **"Add Bot User Event"**
4. Add: `file_shared`
5. Click **"Save Changes"**

#### 3.6 Invite Bot to Channel/DM
- **Option A**: DM the bot directly
  - Find your bot in Slack's Apps section
  - Click on it to open a DM
- **Option B**: Invite to a channel
  - In any channel, type: `/invite @LinkedIn Screener Bot`

---

### Step 4: Install and Run the Bot

#### 4.1 Clone Repository
```bash
git clone https://github.com/mglynnhenley/linkedin-screener-bot.git
cd linkedin-screener-bot
```

#### 4.2 Install Dependencies
```bash
npm install
```

#### 4.3 Configure Environment Variables
Create a `.env` file with your tokens:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your tokens:
```

Your `.env` should look like:
```env
# Slack tokens from Step 3
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# OpenAI key from Step 2
OPENAI_API_KEY=sk-your-openai-key-here

# Relevance AI endpoint from Step 1
RELEVANCE_API_URL=https://api-region.stack.tryrelevance.com/latest/studios/your-studio-id/trigger_limited
```

#### 4.4 Run Locally (Test)
```bash
node index.js
```

You should see:
```
⚡️ Bolt app is running!
```

✅ **Test it**: Upload a CSV with LinkedIn URLs to Slack and watch it work!

---

### Step 5: Deploy to Railway (24/7 Hosting)

Once you've tested locally, deploy to Railway so it runs 24/7.

#### 5.1 Push to GitHub
```bash
# Already done - your repo is at:
# https://github.com/mglynnhenley/linkedin-screener-bot
```

#### 5.2 Deploy to Railway
1. Go to **https://railway.app**
2. Click **"Login"** → Sign in with **GitHub**
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose **`mglynnhenley/linkedin-screener-bot`**
6. Railway will detect the `Dockerfile` and start building

#### 5.3 Add Environment Variables in Railway
1. Once deployed, click on your service
2. Go to the **"Variables"** tab
3. Click **"New Variable"** and add all 4:
   - `SLACK_BOT_TOKEN` = (your xoxb- token)
   - `SLACK_APP_TOKEN` = (your xapp- token)
   - `OPENAI_API_KEY` = (your sk- key)
   - `RELEVANCE_API_URL` = (your Relevance endpoint)

#### 5.4 Verify Deployment
1. Go to **"Deployments"** tab
2. Click on the latest deployment
3. Check **"View Logs"**
4. You should see: `⚡️ Bolt app is running!`

✅ **Your bot is now live 24/7!**

---

## Usage

### Prepare Your CSV
Your CSV should have LinkedIn profile URLs. Column name doesn't matter - the bot auto-detects.

**Example CSV:**
```csv
Name,LinkedIn Profile,Email
John Doe,https://linkedin.com/in/johndoe,john@example.com
Jane Smith,https://linkedin.com/in/janesmith,jane@example.com
Bob Wilson,https://www.linkedin.com/in/bobwilson/,bob@example.com
```

### Upload to Slack
1. Go to your Slack DM with the bot (or channel where bot is invited)
2. Click the **"+"** icon or **"Upload file"**
3. Select your CSV file
4. Click **"Upload"**

### Get Results
The bot will:
1. ✅ Acknowledge: "📊 Processing your-file.csv..."
2. 🔍 Extract LinkedIn URLs
3. 🌐 Enrich profiles via Relevance AI
4. 🤖 Rate each profile 1-10 with OpenAI
5. 📊 Post summary with top 5 candidates
6. 📎 Upload full results CSV

**All messages appear in the same thread!**

---

## Understanding the Ratings

### Rating Scale
- **9-10**: Exceptional (rare) - Deep expertise + proven builder + clear availability
- **7-8**: Strong candidate - Multiple founder signals, minimal gaps
- **5-6**: Solid but unproven - Has potential, missing key evidence
- **3-4**: Weak - Generic background, limited ownership
- **1-2**: Poor fit - No relevant signals or red flags

### What the Bot Looks For
- **Experience tenure**: 2+ years at quality companies shows depth
- **Domain expertise**: Deep knowledge in specific verticals (fintech, healthtech, devtools, etc.)
- **Builder signals**: Shipped products, led teams, drove outcomes
- **Availability**: Recently left job or signals readiness to start
- **Education**: Top-tier universities (Stanford, MIT, Oxbridge, etc.)
- **Career stage**: Junior profiles need stronger credentials than senior

### Example Reasoning
> "Rating: 8. Former Senior Engineer at Stripe (3 years) building payments infrastructure, recently left and open to new opportunities. Strong technical depth in fintech domain, clear 0→1 ownership signals."

---

## Cost Breakdown

**Per 100 profiles:**
- Relevance AI: ~$1-2
- OpenAI GPT-4: ~$1-5
- Railway hosting: Free tier or ~$5/month
- **Total**: ~$2-12 per 100 profiles

---

## Troubleshooting

### Bot Not Responding
- Check Railway logs: Go to your service → Deployments → View Logs
- Verify all 4 environment variables are set
- Ensure bot is invited to the channel/DM

### "No LinkedIn URLs found"
- CSV must contain links with `linkedin.com`
- Any column name works - bot auto-detects
- Check the CSV isn't empty

### OpenAI Errors
- Verify API key is correct
- Check you have billing credits: https://platform.openai.com/account/billing
- Ensure you have GPT-4 access (may require credits added first)

### Relevance AI Errors
- Test your endpoint manually with a sample URL
- Verify the endpoint returns profile data in expected format
- Check you have credits remaining

### Slack Errors
- Verify both tokens (xoxb- and xapp-) are correct
- Check bot has all 3 permissions: `files:read`, `chat:write`, `app_mentions:read`
- Ensure Event Subscriptions has `file_shared` event

---

## Project Structure

```
linkedin-screener-bot/
├── index.js              # Main bot code
├── package.json          # Dependencies
├── Dockerfile           # Docker config for Railway
├── .dockerignore        # Files to exclude from Docker
├── .env                 # Your tokens (NOT in git)
├── .env.example         # Example env file template
└── README.md            # This file
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/mglynnhenley/linkedin-screener-bot/issues
- Email: matildaglynnh@gmail.com

---

## License

MIT
