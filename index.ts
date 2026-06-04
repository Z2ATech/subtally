export interface Env {
	DB: D1Database;
	SESSIONS_KV: KVNamespace;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}

import { drizzle } from "drizzle-orm/d1";
import { createAuth } from "./src/auth";
import { getAccessTokenFromRefresh, listMessages, getMessage } from "./src/lib/gmail";

let auth: ReturnType<typeof createAuth> | null = null;

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("server is healthy", { status: 200 });
		}

		if (url.pathname.startsWith("/api/auth/")) {
			if (!auth) auth = createAuth(env);
			return auth.handler(request);
		}

		if (url.pathname === "/api/gmail/scan" && request.method === "GET") {
			if (!auth) auth = createAuth(env);
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session) return new Response("Unauthorized", { status: 401 });

			const after = url.searchParams.get("after");
			const before = url.searchParams.get("before");

			const parts = ["subject:(subscription OR invoice OR receipt OR billing OR payment OR renewal OR order OR bill OR statement OR charge OR charged OR debit OR transaction OR purchase OR overdue OR \"auto-pay\" OR autopay OR \"payment due\" OR \"amount due\")"];
			if (after) parts.push(`after:${after.replace(/-/g, "/")}`);
			if (before) parts.push(`before:${before.replace(/-/g, "/")}`);

			const db = drizzle(env.DB);
			const accessToken = await getAccessTokenFromRefresh(db, session.user.id, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
			if (!accessToken) return new Response("No Gmail token found", { status: 404 });

			try {
				const { messages, nextPageToken } = await listMessages(accessToken, parts.join(" "));

				const results = await Promise.all(
					(messages ?? []).map(async ({ id, threadId }) => {
						const msg = await getMessage(accessToken, id);
						const get = (name: string) => msg.payload.headers.find((h) => h.name === name)?.value ?? "";
						return { id, threadId, from: get("From"), subject: get("Subject"), date: get("Date") };
					})
				);

				return Response.json({ messages: results, ...(nextPageToken && { nextPageToken }) });
			} catch {
				return new Response("Gmail fetch failed", { status: 502 });
			}
		}

		return new Response("Not Found", { status: 404 });
	},
};
