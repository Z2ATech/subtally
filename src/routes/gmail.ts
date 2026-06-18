import type { Env } from "../../index";
import type { createAuth } from "../auth";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getConstants } from "../constants";
import * as schema from "../db/schema";
import { getAccessTokenFromRefresh, listMessages, getMessage } from "../lib/gmail";
import { extractBodyBytes, extractDomain, computeChecksum } from "../lib/email";
import { anonymize } from "../lib/anonymizer";
import { extractSubscriptionData } from "../lib/llm";
import { deriveStatus } from "../lib/status";
import { checkRateLimit } from "../lib/ratelimit";

export async function handleGmailScan(
	request: Request,
	env: Env,
	auth: ReturnType<typeof createAuth>,
): Promise<Response> {
	const url = new URL(request.url);
	const constants = getConstants(env);
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return new Response("Unauthorized", { status: 401 });

	const rateLimitResponse = await checkRateLimit(env.RATE_LIMITER, session.user.id);
	if (rateLimitResponse) return rateLimitResponse;

	const db = drizzle(env.DB);
	const accessToken = await getAccessTokenFromRefresh(
		db,
		session.user.id,
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		constants.GMAIL_TOKEN_URL,
	);
	if (!accessToken) return new Response("No Gmail token found", { status: 404 });

	const query =
		'subject:(subscription OR invoice OR receipt OR renewal OR payment OR "auto-pay" OR autopay OR "payment due" OR "amount due" OR billing) -from:bitbucket.org -from:trello.com';
	const pageToken = url.searchParams.get("pageToken") ?? undefined;
	console.log(`[scan] user=${session.user.id} pageToken=${pageToken ?? "none"}`);

	try {
		const { messages, nextPageToken } = await listMessages(
			accessToken,
			query,
			constants.GMAIL_API_BASE,
			pageToken,
		);
		const all = messages ?? [];
		console.log(`[scan] fetched ${all.length} messages`);

		let processed = 0;
		let skipped = 0;

		const CHUNK_SIZE = 10;
		for (let i = 0; i < all.length; i += CHUNK_SIZE) {
			const chunk = all.slice(i, i + CHUNK_SIZE);
			await Promise.all(
				chunk.map(async ({ id }) => {
					try {
						const msg = await getMessage(accessToken, id, constants.GMAIL_API_BASE);
						const bodyBytes = extractBodyBytes(msg.payload);
						const from =
							msg.payload.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
						const senderDomain = extractDomain(from);
						console.log(`[msg:${id}] from="${from}" domain="${senderDomain}" size=${bodyBytes.length} bytes`);

						if (!senderDomain) {
							console.log(`[msg:${id}] skipped: no domain (from="${from}")`);
							skipped++;
							return;
						}

						const checksum = await computeChecksum(bodyBytes, senderDomain);

						const existing = await db
							.select({ id: schema.processed_emails.id })
							.from(schema.processed_emails)
							.where(
								and(
									eq(schema.processed_emails.user_id, session.user.id),
									eq(schema.processed_emails.checksum, checksum),
								),
							)
							.limit(1);

						if (existing.length > 0) {
							console.log(`[msg:${id}] skipped: duplicate (domain=${senderDomain})`);
							skipped++;
							return;
						}

						const bodyText = new TextDecoder()
							.decode(bodyBytes)
							.replace(/<[^>]+>/g, " ")
							.replace(/\s+/g, " ")
							.trim();
						const extraction = await extractSubscriptionData(
							anonymize(bodyText),
							constants.OPENAI_API_BASE,
							env.OPENAI_API_SECRET,
							env.OPENAI_MODEL,
						);
						console.log(
							`[msg:${id}] llm: vendor=${extraction?.vendor_name ?? "null"} type=${extraction?.email_type ?? "null"} amount=${extraction?.amount ?? "null"} currency=${extraction?.currency ?? "null"}`,
						);

						if (!extraction) {
							skipped++;
							return;
						}

						if (extraction.email_type === "unknown") {
							console.log(`[msg:${id}] skipped: unknown type (domain=${senderDomain})`);
							skipped++;
							return;
						}

						if (extraction.confidence < 0.7) {
							console.log(`[msg:${id}] skipped: low confidence (${extraction.confidence})`);
							await db.insert(schema.processed_emails).values({ user_id: session.user.id, checksum }).onConflictDoNothing();
							skipped++;
							return;
						}

						const isSubscriptionRelated =
							extraction.category !== null ||
							extraction.email_type === "subscription" ||
							extraction.email_type === "renewal" ||
							extraction.email_type === "cancellation";

						if (!isSubscriptionRelated) {
							console.log(
								`[msg:${id}] skipped: noise (type=${extraction.email_type} category=${extraction.category ?? "null"})`,
							);
							await db
								.insert(schema.processed_emails)
								.values({ user_id: session.user.id, checksum })
								.onConflictDoNothing();
							skipped++;
							return;
						}

						const emailType = extraction.email_type;
						const emailDate = new Date(Number(msg.internalDate));
						const price_cents = extraction.amount ? Math.round(extraction.amount * 100) : null;
						const next_billing_date = extraction.next_billing_date
							? new Date(extraction.next_billing_date)
							: null;

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

						const latest = await db
							.select({ price_cents: schema.subscriptions.price_cents })
							.from(schema.subscriptions)
							.where(eq(schema.subscriptions.service_id, rows[0].id))
							.orderBy(desc(schema.subscriptions.created_at))
							.limit(1);

						const amountChanged = latest[0] != null && latest[0].price_cents !== price_cents;

						const [sub] = await db
							.insert(schema.subscriptions)
							.values({
								user_id: session.user.id,
								service_id: rows[0].id,
								status: "detected",
								vendor_name: extraction.vendor_name,
								price_cents,
								currency: extraction.currency,
								billing_frequency: extraction.frequency,
								next_billing_date,
								category: extraction.category,
								email_type: emailType,
							})
							.onConflictDoUpdate({
								target: [schema.subscriptions.user_id, schema.subscriptions.service_id],
								set: {
									vendor_name: extraction.vendor_name,
									price_cents,
									currency: extraction.currency,
									billing_frequency: extraction.frequency,
									next_billing_date,
									category: extraction.category,
									email_type: emailType,
									updated_at: new Date(),
								},
							})
							.returning({ id: schema.subscriptions.id });

						if (!sub) { skipped++; return; }

						await db.insert(schema.subscription_events).values({
							subscription_id: sub.id,
							event_type: extraction.email_type,
							amount_cents: price_cents,
							occurred_at: emailDate,
						});

						if (amountChanged) {
							console.log(`[msg:${id}] amount changed: prev=${latest[0]?.price_cents ?? "null"} new=${price_cents}`);
							await db.insert(schema.subscription_events).values({
								subscription_id: sub.id,
								event_type: "amount_changed",
								amount_cents: price_cents,
								occurred_at: emailDate,
							});
						}

						await db
							.insert(schema.processed_emails)
							.values({ user_id: session.user.id, checksum })
							.onConflictDoNothing();

						console.log(`[msg:${id}] inserted: vendor=${extraction?.vendor_name ?? "null"} domain=${senderDomain}`);
						processed++;
					} catch (err) {
						console.error(`[msg:${id}] error:`, err);
						skipped++;
					}
				}),
			);
		}

		// Reconciliation: 2 queries instead of N+1
		const userSubs = await db
			.select({
				id: schema.subscriptions.id,
				billing_frequency: schema.subscriptions.billing_frequency,
				status: schema.subscriptions.status,
				email_type: schema.subscriptions.email_type,
			})
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.user_id, session.user.id));

		if (userSubs.length > 0) {
			const subIds = userSubs.map((s) => s.id);

			const allEvents = await db
				.select({
					subscription_id: schema.subscription_events.subscription_id,
					event_type: schema.subscription_events.event_type,
					occurred_at: schema.subscription_events.occurred_at,
				})
				.from(schema.subscription_events)
				.where(inArray(schema.subscription_events.subscription_id, subIds))
				.orderBy(desc(schema.subscription_events.occurred_at));

			// Pick latest event per subscription in JS (already sorted DESC)
			const latestEventMap = new Map<string, { event_type: string; occurred_at: Date | null }>();
			for (const event of allEvents) {
				if (!latestEventMap.has(event.subscription_id)) {
					latestEventMap.set(event.subscription_id, {
						event_type: event.event_type,
						occurred_at: event.occurred_at,
					});
				}
			}

			const EMAIL_TYPES = new Set(["subscription", "renewal", "cancellation"]);

			await Promise.all(
				userSubs.map((sub) => {
					const latest = latestEventMap.get(sub.id);
					const derived = deriveStatus(
						latest?.event_type ?? null,
						latest?.occurred_at ?? null,
						sub.billing_frequency,
					);
					// Only update email_type for meaningful event types; ignore amount_changed
					const derivedEmailType =
						latest?.event_type && EMAIL_TYPES.has(latest.event_type)
							? latest.event_type
							: sub.email_type;

					if (derived === sub.status && derivedEmailType === sub.email_type) return Promise.resolve();
					return db
						.update(schema.subscriptions)
						.set({ status: derived, email_type: derivedEmailType, updated_at: new Date() })
						.where(eq(schema.subscriptions.id, sub.id));
				}),
			);
		}

		return Response.json({ processed, skipped, ...(nextPageToken && { nextPageToken }) });
	} catch (err) {
		console.error("Gmail scan error:", err);
		return new Response("Gmail fetch failed", { status: 502 });
	}
}
