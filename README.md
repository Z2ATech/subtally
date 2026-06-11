# SubTally

Privacy-first subscription tracker. Scans Gmail for receipts, extracts billing details with AI, and shows them in a clean dashboard.

---

**What it does**

- Reads Gmail receipts (read-only access)
- Extracts vendor, amount, frequency, next billing date
- Tracks your subscription history — signups, renewals, cancellations, plan changes
- Shows active subs, upcoming bills, and total spend
- Works on web and mobile

---

**How it works**

```
┌─────────────┐     ┌─────────────┐
│  Mobile     │     │    Web      │
│  (Expo)     │     │  (TanStack) │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 │
        ┌────────┴────────┐
        │  Cloudflare     │
        │    Worker       │
        │                 │
        │  ┌───────────┐  │
        │  │ Better    │  │
        │  │ Auth      │  │
        │  └───────────┘  │
        │  ┌───────────┐  │
        │  │ Gmail     │  │
        │  │ Ingestion │  │
        │  └───────────┘  │
        │  ┌───────────┐  │
        │  │ LLM       │  │
        │  │ Extract   │  │
        │  └───────────┘  │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌───────┐   ┌────────┐   ┌─────────┐
│  D1   │   │   KV   │   │ GPT-4o  │
│  DB   │   │ Cache  │   │  mini   │
└───────┘   └────────┘   └─────────┘
```

**Request flow**

1. User signs in with Google (via Better Auth)
2. User taps Refresh — Worker fetches recent emails from Gmail API
3. Each email is anonymized in-memory (PII stripped)
4. Anonymized text goes to GPT-4o-mini for extraction
5. Extracted metadata is stored in D1
6. Dashboard displays subscriptions, upcoming bills, and history

---

**Stack**

| Layer | Choice |
|-------|--------|
| Web | TanStack Start on Cloudflare Workers |
| Mobile | React Native + Expo |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Auth | Better Auth with Google OAuth2 |
| AI | GPT-4o-mini |

---

**Privacy**

- Raw emails are never stored on disk or in the database
- Content is anonymized in-memory before AI processing
- Only sender domain (e.g. netflix.com) and a SHA-256 content hash are kept
- No raw body, subject, or sender email persisted

---

**Repo layout**

```
packages/core/   # Shared hooks, types, API client, auth config
apps/web/        # TanStack Start app
apps/mobile/     # Expo app
```

Web and mobile share business logic through `core`. Each has its own UI.

---

**Auth**

Better Auth runs inside the Cloudflare Worker at `/api/auth/*`.

- **Web:** Uses `@better-auth/react` hooks. Sessions via HTTP cookies.
- **Mobile:** Uses the REST API directly. Session token stored in `expo-secure-store`.
- Google sign-in requests `gmail.readonly` scope so we can read receipts.

**Sync**

On-demand only. User taps Refresh to scan Gmail. No background polling, no cron jobs.

**Status tracking**

Every email that changes a subscription creates an event:

- `created` — first time we see this subscription
- `renewed` — recurring charge detected
- `cancelled` — cancellation email found
- `amount_changed` — price or plan change

Subscription status (`active`, `cancelled`, `unknown`) is derived from the event history, not set manually.

---

## Setup

```bash
bun install
```

## Local Development

```bash
bun run dev
```

Visit `http://localhost:8787/health` to verify the Worker is running.

## Environment Variables

Create `.env` in the project root (never commit this):

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:8787
GMAIL_TOKEN_URL=https://oauth2.googleapis.com/token
GMAIL_API_BASE=https://gmail.googleapis.com/gmail/v1
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_SECRET=
```

Generate a secure `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

For production, store secrets via Wrangler:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put OPENAI_API_SECRET
```

## D1 Migrations

```bash
bun run db:generate       # generate SQL from schema
bun run db:migrate:local  # apply locally
```

Verify tables:

```bash
npx wrangler d1 execute subtally_db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

## Testing the Gmail Scan + LLM Extraction

1. Start the dev server: `bun run dev`
2. Sign in via Google OAuth — open the browser console at `http://localhost:8787` and run:

```js
fetch('/api/auth/sign-in/social', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'google', callbackURL: '/' })
}).then(r => r.json()).then(d => { location.href = d.url })
```

3. Once signed in, run the scan from the browser console:

```js
async function testScan() {
  console.log('Starting scan...');
  const start = Date.now();
  let totalProcessed = 0, totalSkipped = 0, page = 1, pageToken = null;
  while (true) {
    const url = pageToken ? `/api/gmail/scan?pageToken=${pageToken}` : '/api/gmail/scan';
    const res = await fetch(url);
    if (!res.ok) { console.error('Error:', res.status, await res.text()); return; }
    const data = await res.json();
    totalProcessed += data.processed;
    totalSkipped += data.skipped;
    console.log(`Page ${page} — processed: ${data.processed}, skipped: ${data.skipped}`);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
    page++;
  }
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.table({ totalProcessed, totalSkipped, pages: page });
}
testScan();
```

4. Inspect results:

```bash
npx wrangler d1 execute subtally_db --local --command "SELECT vendor_name, currency, billing_frequency, status, email_type FROM subscriptions WHERE vendor_name IS NOT NULL ORDER BY created_at DESC LIMIT 50;"
```

5. Reset and re-scan (if testing prompt changes):

```bash
npx wrangler d1 execute subtally_db --local --command "DELETE FROM subscription_events; DELETE FROM subscriptions; DELETE FROM processed_emails;"
```
