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

---

**Sync**

On-demand only. User taps Refresh to scan Gmail. No background polling, no cron jobs.

---

**Status tracking**

Every email that changes a subscription creates an event:

- `created` — first time we see this subscription
- `renewed` — recurring charge detected
- `cancelled` — cancellation email found
- `amount_changed` — price or plan change

Subscription status (`active`, `cancelled`, `unknown`) is derived from the event history, not set manually.
# Fourth test for webhook prompt v4
