# Jakobov Listing Automation

Scans Gmail for FlexMLS listing emails, builds Canva social media creatives, and tracks what has been posted — built for The Jakobov Group.

---

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- InsForge (Postgres + auto-generated REST API)
- Canva Connect API
- Gmail API (Google OAuth)
- Claude API (caption generation)
- Deployed on Vercel

---

## Setup

### 1. Create the database schema

Open your InsForge project's SQL editor and run the contents of `scripts/create-schema.sql`. This creates the `listings`, `agents`, and `listing_photos` tables.

### 2. Seed the agents table

Copy `.env.example` to `.env.local` and fill in at minimum `INSFORGE_API_URL` and `INSFORGE_API_KEY`, then run:

```bash
npm run seed
```

This inserts all 21 agents. You can add Canva headshot asset IDs for each agent in the InsForge dashboard later.

### 3. Connect Gmail

**Create a Google Cloud project:**

1. Go to console.cloud.google.com and create a project.
2. Enable the **Gmail API**.
3. Create OAuth 2.0 credentials (Web application type).
4. Add `http://localhost:3000/api/auth/gmail/callback` (and your Vercel domain) as authorized redirect URIs.
5. Copy the Client ID and Secret into `.env.local` as `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

**Get a refresh token:**

Use the Google OAuth Playground or run a one-time token exchange for `ben@jakobovgroup.com`:

1. Visit: `https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/gmail.readonly&response_type=code&access_type=offline&prompt=consent`
2. Sign in as `ben@jakobovgroup.com`, approve, copy the code.
3. Exchange for tokens: `curl -X POST https://oauth2.googleapis.com/token -d "code=CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&redirect_uri=urn:ietf:wg:oauth:2.0:oob&grant_type=authorization_code"`
4. Copy the `refresh_token` value into `GMAIL_REFRESH_TOKEN`.

### 4. Connect Canva

1. Go to the Canva Developer Portal and create a new app with **Design Autofill** and **Asset Upload** scopes.
2. Add your Vercel domain as an authorized redirect URI.
3. Copy `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET` into env vars.
4. Complete the OAuth flow via `/settings` → Connect Canva to get an access token; store it as `CANVA_ACCESS_TOKEN`.

### 5. Set the Canva template and asset IDs

In your Canva account:

- Open your listing template, copy the design ID from the URL (`/design/DESIGN_ID/...`), and set `CANVA_TEMPLATE_ID`.
- Upload BG-removed headshots for each agent to Canva; note each asset ID and enter it in the agents table via the InsForge dashboard.
- Upload regular and luxury eXp logos; set `CANVA_LOGO_REGULAR_ASSET_ID` and `CANVA_LOGO_LUXURY_ASSET_ID`.
- Set `CANVA_HEADSHOTS_FOLDER_ID` to the folder containing headshots.

**Template page layout (1-based):**

| Status | Page |
|--------|------|
| New Listing | 1 |
| Pending | 5 |
| Coming Soon | 9 |
| Closed | 11 |

### 6. Set the Claude API key

Get an API key from console.anthropic.com and set `ANTHROPIC_API_KEY`. Used for caption generation.

---

## Running a manual scan

Click **Scan Inbox Now** on the dashboard, or call the API directly:

```bash
curl -X POST https://your-app.vercel.app/api/scan
```

This reads all emails from `listingupdates@flexmail.flexmls.com`, parses listings, deduplicates by MLS number, and upserts into the database.

---

## Adding a manual deal

Click **+ New Deal** on the dashboard. Fill in address, status, deal side (Buyer/Seller), agent, bed/bath/size, and price. For Closed deals the price field is labeled "Closed Price" to make it unambiguous. MLS description is optional but used for caption generation.

---

## Generating a caption

Open a listing's detail page and click **Generate Caption**. The AI reads the listing details and MLS description and writes two original paragraphs in the Jakobov Group voice, plus the opener, details block, credit line, and hashtags. You can edit the caption in the text box before copying it.

---

## Processing listing photos

On the listing detail page, upload a source photo to each of the six slots (Living Room, Kitchen, Dining Room, Bedroom, Bathroom, Highlight). Each photo is processed with a blur-fill treatment: the original image sits sharp and uncropped in the center, with a softly blurred zoomed version of itself filling the remaining frame space. Both the original and processed versions are stored and displayed side by side.

---

## Automated daily scan (Vercel cron)

`vercel.json` includes a cron entry that runs `POST /api/scan` at 8:00 AM UTC every day. Adjust the schedule string as needed. Requires a Vercel Pro plan for cron jobs.

---

## Environment variables

See `.env.example` for the full list. All must be set in Vercel project settings for production.
