---
description: Project-specific instructions for AI agents working on the SubTally Cloudflare Workers codebase.
applyTo: '**/*'
---

# SubTally Project Instructions

You are working on **SubTally**, a Cloudflare Workers project.

## Working Style

- Act like an experienced senior engineer.
- Keep responses and changes concise.
- Save tokens.
- Avoid overengineering.
- Do not add unnecessary abstractions, folders, frameworks, or dependencies.
- Prefer simple, maintainable solutions.
- Inspect existing files before making changes.
- Follow the project’s current structure and conventions.
- Do not modify unrelated files.

## Current Tech Context

This project uses:

- **Bun** as the package manager/runtime for local scripts
- **TypeScript**
- **Cloudflare Workers**
- **Wrangler**
- **wrangler.toml** for Cloudflare configuration
- **Cloudflare D1** for database storage
- **Cloudflare KV** for session or temporary key-value storage

## Cloudflare Setup Rules

- Use `wrangler.toml`, not `wrangler.jsonc`.
- Keep the Worker entry simple unless the project grows naturally.
- Prefer the existing root `index.ts` entry file unless there is a clear reason to move it.
- Use official Cloudflare/Wrangler documentation or CLI help when unsure.
- Local development should run through Wrangler.
- Do not require Cloudflare dashboard setup unless remote resources are actually needed.

## Binding Conventions

Use clear binding names:

- D1 database binding: `DB`
- KV namespace binding: `SESSIONS_KV`

For local setup, configure bindings in `wrangler.toml`.

Do not create remote resource IDs manually or guess IDs. If remote D1/KV resources are needed, explain the command or manual step required.

## Boundaries

Do **not** implement future tasks early.

Unless explicitly requested, do not add:

- Google OAuth
- Auth flow
- Encrypted sessions
- D1 schema/migrations
- Business logic
- Routing frameworks
- React/frontend setup
- CI/CD
- Production secrets

Only implement the current assigned task.

## Code Guidelines

- Use TypeScript types where helpful, but avoid excessive type complexity.
- Keep Worker handlers readable and minimal.
- Prefer Web-standard APIs available in Cloudflare Workers.
- Avoid Node-specific APIs unless Cloudflare compatibility is intentionally configured.
- Keep environment bindings typed clearly.
- Add comments only where they explain something non-obvious.

## Package Scripts

Use minimal Bun-compatible scripts.

Common scripts may include:

- `dev` for local Wrangler development
- `deploy` for deployment
- `typecheck` only if useful

Do not add extra scripts unless needed.

## Validation

After changes, provide a short summary including:

1. What changed
2. Files changed
3. Commands to run
4. Any manual follow-up needed

Verify when possible that:

- Local dev starts with Wrangler
- TypeScript has no obvious errors
- Worker responds locally
- D1 and KV bindings are configured correctly

## Communication Style

- Be concise.
- Do not rush into implementation without understanding the task.
- Ask only when required.
- If assumptions are needed, state them briefly.
- Prefer practical engineering decisions over theoretical explanations.
