# subtally

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
OPENAI_MODEL=gpt-5.4-mini
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
