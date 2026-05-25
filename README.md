# subtally

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

Local development with Wrangler
------------------------------

Start local dev server (runs the Worker, with local D1/KV preview):

```bash
bun run dev
```

Visit `http://127.0.0.1:8787/health` to check the Worker is responding.

Google OAuth secrets
--------------------

For local development, Wrangler auto-loads `.env` from the project root. Create it with:

```env
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

Do not commit `.env`.

For production, store the values as Wrangler Secrets:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

OAuth consent screen setup and credential creation happen in Google Cloud Console. The Worker only expects these values to be available as environment secrets.

Better Auth setup
-----------------

Better Auth handles authentication and session management. For local development, add the following to `.env`:

```env
BETTER_AUTH_SECRET=<generated-secret>
BETTER_AUTH_URL=http://localhost:8787
```

Generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and set it as `BETTER_AUTH_SECRET` in `.env`.

For production, store as Wrangler Secrets:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

D1 migrations (local)
-------------------

Generate migration SQL from the Drizzle schema:

```bash
bun run db:generate
```

Apply migrations locally:

```bash
bun run db:migrate:local
```

Quick verify (list tables):

```bash
wrangler d1 execute subtally_db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

The generated migration files live in `./migrations`, and Wrangler uses them for local D1 apply.

