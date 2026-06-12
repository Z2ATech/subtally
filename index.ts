export interface Env {
  DB: D1Database;
  SESSIONS_KV: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GMAIL_TOKEN_URL: string;
  GMAIL_API_BASE: string;
  OPENAI_API_BASE: string;
  OPENAI_API_SECRET: string;
  OPENAI_MODEL: string;
  GMAIL_READONLY_SCOPE: string;
}

import { createAuth } from "./src/auth";
import { handleGmailScan } from "./src/routes/gmail";
import { handleReadRoutes } from "./src/routes/read";

let auth: ReturnType<typeof createAuth> | null = null;

export default {
  async fetch(request: Request, env: Env) {
    if (!auth) auth = createAuth(env);
    const url = new URL(request.url);

    if (url.pathname === "/health")
      return new Response("server is healthy", { status: 200 });

    if (url.pathname.startsWith("/api/auth/"))
      return auth.handler(request);

    if (url.pathname === "/api/gmail/scan" && request.method === "GET")
      return handleGmailScan(request, env, auth);

    if (
      url.pathname.startsWith("/api/subscriptions") ||
      url.pathname === "/api/services" ||
      url.pathname === "/api/upcoming" ||
      url.pathname === "/api/stats"
    ) return handleReadRoutes(request, env, auth);

    return new Response("Not Found", { status: 404 });
  },
};
