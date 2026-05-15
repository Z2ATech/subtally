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

D1 migrations (local)
-------------------

Create a new migration (creates a file under `migrations/`):

```bash
wrangler d1 migrations create subtally_db initial
```

Apply migrations locally:

```bash
wrangler d1 migrations apply subtally_db --local
```

Quick verify (list tables):

```bash
wrangler d1 execute subtally_db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

