export interface Env {
  DB: D1Database;
  SESSIONS_KV: KVNamespace;
  RATE_LIMITER: RateLimit;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_APP_URL: string;
  GMAIL_TOKEN_URL: string;
  GMAIL_API_BASE: string;
  OPENAI_API_BASE: string;
  OPENAI_API_SECRET: string;
  OPENAI_MODEL: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
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

    if (url.pathname.startsWith("/api/auth/")) {
      // Browser auth client (apps/web) calls these cross-origin, so CORS is
      // required. Better Auth emits no CORS headers and 404s OPTIONS itself.
      const origin = request.headers.get("Origin");
      const allowed = origin && origin === env.WEB_APP_URL ? origin : null;

      if (request.method === "OPTIONS") {
        const headers: Record<string, string> = {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        };
        if (allowed) {
          headers["Access-Control-Allow-Origin"] = allowed;
          headers["Access-Control-Allow-Credentials"] = "true";
        }
        return new Response(null, { status: 204, headers });
      }

      const res = await auth.handler(request);
      if (!allowed) return res;
      const headers = new Headers(res.headers);
      headers.set("Access-Control-Allow-Origin", allowed);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.append("Vary", "Origin");
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    }

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
