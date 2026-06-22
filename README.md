# SubTally

Privacy-first subscription tracker. Connects to Gmail, extracts subscription data via LLM, tracks billing history. No raw email content stored.

## Stack

- **Backend:** Cloudflare Workers, D1, Drizzle ORM, Better Auth, Gmail API
- **Frontend:** TanStack Start (Vite), Tailwind CSS, shadcn/ui
- **LLM:** OpenAI or Gemini (auto-selected from env)
- **Monorepo:** Bun workspaces — backend at root, `apps/web/`, `packages/core/`

---

## Setup

```bash
bun install
```

### Environment Variables

Create `.env` at the repo root:

```env
# Google OAuth + Better Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_SECRET=        # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:8787

# Gmail API
GMAIL_TOKEN_URL=https://oauth2.googleapis.com/token
GMAIL_API_BASE=https://gmail.googleapis.com/gmail/v1
GMAIL_READONLY_SCOPE=https://www.googleapis.com/auth/gmail.readonly

# LLM — set GEMINI_API_KEY to use Gemini, otherwise OpenAI is used
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_SECRET=
OPENAI_MODEL=gpt-5.4-mini

GEMINI_API_KEY=            # leave blank to use OpenAI
```

Create `apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:8787
```

### D1 Migrations

```bash
bun run db:generate
bun run db:migrate:local
```

---

## Local Development

```bash
bun run dev
```

Starts both workers concurrently:
- Backend → `http://localhost:8787`
- Frontend → `http://localhost:3000`

Health check: `GET http://localhost:8787/health`

---

## Authentication

Open `http://localhost:3000` — OAuth flow initiates from the frontend and completes via the backend at `localhost:8787`. Do not mix `localhost` and `127.0.0.1` — cookie scope mismatch causes `state_not_found`.

---

## Gmail Scan

After signing in, run from the **`localhost:8787` browser console**:

```js
let page = 1, token = null;
do {
  const url = token ? `/api/gmail/scan?pageToken=${token}` : '/api/gmail/scan';
  const r = await fetch(url).then(r => r.json());
  console.log(`Page ${page++}: processed=${r.processed} skipped=${r.skipped}`);
  token = r.nextPageToken;
} while (token);
console.log('Done');
```

First scan paginates the full inbox. Subsequent syncs via the "Sync Gmail" button use Gmail's History API — only new emails since the last scan are fetched.

---

## Inspect Results

```bash
npx wrangler d1 execute subtally_db --local --command "
SELECT vendor_name, status, billing_frequency, currency, price_cents, email_type
FROM subscriptions
WHERE vendor_name IS NOT NULL
ORDER BY status, vendor_name;"
```

---

## Reset

Full reset (re-scan from scratch):

```bash
npx wrangler d1 execute subtally_db --local --command "
DELETE FROM subscription_events;
DELETE FROM subscriptions;
DELETE FROM services;
DELETE FROM processed_emails;
DELETE FROM user_scan_state;"
```

---

## Production Secrets

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put OPENAI_API_SECRET   # or GEMINI_API_KEY
```
