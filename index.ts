export interface Env {
	DB: D1Database;
	SESSIONS_KV: KVNamespace;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createAuth } from "./src/auth";
import * as schema from "./src/db/schema";
import { getAccessTokenFromRefresh, listMessages, getMessage } from "./src/lib/gmail";

let auth: ReturnType<typeof createAuth> | null = null;

function base64urlToBytes(b64: string): Uint8Array {
	const b64std = b64.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(b64std);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function extractHeader(rawBytes: Uint8Array, name: string): string {
	const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: false }).decode(rawBytes);
	const headerEnd = text.indexOf("\r\n\r\n");
	const headers = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
	const unfolded = headers.replace(/\r\n[ \t]+/g, " ");
	for (const line of unfolded.split("\r\n")) {
		const colon = line.indexOf(":");
		if (colon > 0 && line.slice(0, colon).toLowerCase() === name.toLowerCase()) {
			return line.slice(colon + 1).trim();
		}
	}
	return "";
}

function extractDomain(from: string): string {
	const match = from.match(/<([^>]+)>/) ?? from.match(/(\S+@\S+)/);
	if (!match?.[1]) return "";
	const [, domain] = match[1].split("@");
	return domain ? domain.toLowerCase() : "";
}

async function computeChecksum(rawBytes: Uint8Array, senderDomain: string): Promise<string> {
	const domainBytes = new TextEncoder().encode(senderDomain);
	const combined = new Uint8Array(rawBytes.length + domainBytes.length);
	combined.set(rawBytes);
	combined.set(domainBytes, rawBytes.length);
	const buf = await crypto.subtle.digest("SHA-256", combined);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

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

			const db = drizzle(env.DB);
			const accessToken = await getAccessTokenFromRefresh(db, session.user.id, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
			if (!accessToken) return new Response("No Gmail token found", { status: 404 });

			const query = "subject:(subscription OR invoice OR receipt OR billing OR payment OR renewal OR order OR bill OR statement OR charge OR charged OR debit OR transaction OR purchase OR overdue OR \"auto-pay\" OR autopay OR \"payment due\" OR \"amount due\")";
			const pageToken = url.searchParams.get("pageToken") ?? undefined;

			try {
				const { messages, nextPageToken } = await listMessages(accessToken, query, pageToken);

				let processed = 0;
				let skipped = 0;

				for (const { id } of messages ?? []) {
					try {
						const msg = await getMessage(accessToken, id);
						const rawBytes = base64urlToBytes(msg.raw);
						const from = extractHeader(rawBytes, "From");
						const senderDomain = extractDomain(from);
						if (!senderDomain) { skipped++; continue; }

						const checksum = await computeChecksum(rawBytes, senderDomain);

						const existing = await db
							.select({ id: schema.subscriptions.id })
							.from(schema.subscriptions)
							.where(eq(schema.subscriptions.checksum, checksum))
							.limit(1);

						if (existing.length > 0) { skipped++; continue; }

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

						if (!rows[0]) { skipped++; continue; }

						await db.insert(schema.subscriptions).values({
							user_id: session.user.id,
							service_id: rows[0].id,
							status: "detected",
							checksum,
						});

						processed++;
					} catch {
						skipped++;
					}
				}

				return Response.json({ processed, skipped, ...(nextPageToken && { nextPageToken }) });
			} catch {
				return new Response("Gmail fetch failed", { status: 502 });
			}
		}

		return new Response("Not Found", { status: 404 });
	},
};
