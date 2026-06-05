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
}

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createAuth } from "./src/auth";
import { getConstants } from "./src/constants";
import * as schema from "./src/db/schema";
import { getAccessTokenFromRefresh, listMessages, getMessage } from "./src/lib/gmail";
import { extractBodyBytes, extractDomain, computeChecksum } from "./src/lib/email";

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
			const constants = getConstants(env);
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session) return new Response("Unauthorized", { status: 401 });

			const db = drizzle(env.DB);
			const accessToken = await getAccessTokenFromRefresh(db, session.user.id, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, constants.GMAIL_TOKEN_URL);
			if (!accessToken) return new Response("No Gmail token found", { status: 404 });

			const query = "subject:(subscription OR invoice OR receipt OR billing OR payment OR renewal OR order OR bill OR statement OR charge OR charged OR debit OR transaction OR purchase OR overdue OR \"auto-pay\" OR autopay OR \"payment due\" OR \"amount due\")";
			const pageToken = url.searchParams.get("pageToken") ?? undefined;

			try {
				const { messages, nextPageToken } = await listMessages(accessToken, query, constants.GMAIL_API_BASE, pageToken);

				let processed = 0;
				let skipped = 0;

				const CHUNK_SIZE = 10;
				const all = messages ?? [];
				for (let i = 0; i < all.length; i += CHUNK_SIZE) {
					const chunk = all.slice(i, i + CHUNK_SIZE);
					await Promise.all(chunk.map(async ({ id }) => {
						try {
							const msg = await getMessage(accessToken, id, constants.GMAIL_API_BASE);
							const bodyBytes = extractBodyBytes(msg.payload);
							const from = msg.payload.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
							const senderDomain = extractDomain(from);
							if (!senderDomain) { skipped++; return; }

							const checksum = await computeChecksum(bodyBytes, senderDomain);

							const existing = await db
								.select({ id: schema.subscriptions.id })
								.from(schema.subscriptions)
								.where(eq(schema.subscriptions.checksum, checksum))
								.limit(1);

							if (existing.length > 0) { skipped++; return; }

							const rows = await db
								.insert(schema.services)
								.values({
									name: senderDomain,
									owner_user_id: session.user.id,
									sender_domain: senderDomain,
									email_count: 1,
									last_email_at: new Date(),
								})
								.onConflictDoUpdate({
									target: [schema.services.owner_user_id, schema.services.sender_domain],
									set: {
										email_count: sql`${schema.services.email_count} + 1`,
										last_email_at: new Date(),
										updated_at: new Date(),
									},
								})
								.returning({ id: schema.services.id });

							if (!rows[0]) { skipped++; return; }

							await db.insert(schema.subscriptions).values({
								user_id: session.user.id,
								service_id: rows[0].id,
								status: "detected",
								checksum,
							});

							processed++;
						} catch (err) {
							console.error(`Failed to process message ${id}:`, err);
							skipped++;
						}
					}));
				}

				return Response.json({ processed, skipped, ...(nextPageToken && { nextPageToken }) });
			} catch (err) {
				console.error("Gmail scan error:", err);
				return new Response("Gmail fetch failed", { status: 502 });
			}
		}

		return new Response("Not Found", { status: 404 });
	},
};
