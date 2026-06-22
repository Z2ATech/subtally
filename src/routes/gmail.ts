import type { Env } from "../../index";
import type { createAuth } from "../auth";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getConstants } from "../constants";
import * as schema from "../db/schema";
import {
	getAccessTokenFromRefresh,
	listMessages,
	getMessage,
	getProfile,
	getHistory,
	HistoryExpiredError,
} from "../lib/gmail";
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

	const pageToken = url.searchParams.get("pageToken") ?? undefined;

	try {
		// Determine which message IDs to process. Prefer an incremental delta via
		// the History API; fall back to the paginated full scan when there's no
		// stored cursor or the history has expired.
		const [scanState] = await db
			.select({ last_history_id: schema.user_scan_state.last_history_id })
			.from(schema.user_scan_state)
			.where(eq(schema.user_scan_state.user_id, session.user.id))
			.limit(1);

		let messageIds: string[] = [];
		let nextPageToken: string | undefined;
		let isScanComplete = true;
		let path: "delta" | "full" = "full";

		if (scanState?.last_history_id) {
			try {
				const { messageIds: deltaIds } = await getHistory(
					accessToken,
					scanState.last_history_id,
					constants.GMAIL_API_BASE,
				);
				path = "delta";
				console.log(
					`[scan] user=${session.user.id} path=delta since=${scanState.last_history_id} delta=${deltaIds.length}`,
				);
				if (deltaIds.length === 0) {
					console.log(`[scan] delta empty — nothing to process`);
					return Response.json({ processed: 0, skipped: 0 });
				}
				messageIds = deltaIds;
			} catch (err) {
				if (!(err instanceof HistoryExpiredError)) throw err;
				console.log(`[scan] history expired — falling back to full scan`);
				path = "full";
			}
		}

		if (path === "full") {
			console.log(`[scan] user=${session.user.id} path=full pageToken=${pageToken ?? "none"}`);
			const { messages, nextPageToken: npt } = await listMessages(
				accessToken,
				"",
				constants.GMAIL_API_BASE,
				pageToken,
			);
			messageIds = (messages ?? []).map((m) => m.id);
			nextPageToken = npt;
			// Only persist the cursor once the final page has been processed.
			isScanComplete = !npt;
		}

		console.log(`[scan] processing ${messageIds.length} messages (path=${path})`);

		let processed = 0;
		let skipped = 0;

		const CHUNK_SIZE = 10;
		for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
			const chunk = messageIds.slice(i, i + CHUNK_SIZE);
			await Promise.all(
				chunk.map(async (id) => {
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
							senderDomain,
							constants.llmApiBase,
							constants.llmApiKey,
							constants.llmModel,
						);
						console.log(
							`[msg:${id}] ${constants.llmModel}: vendor=${extraction?.vendor_name ?? "null"} type=${extraction?.email_type ?? "null"} amount=${extraction?.amount ?? "null"} currency=${extraction?.currency ?? "null"}`,
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

						if (
							(extraction.email_type === "subscription" || extraction.email_type === "renewal") &&
							extraction.amount === null &&
							extraction.frequency === null
						) {
							console.log(`[msg:${id}] skipped: no billing evidence (no amount, no frequency)`);
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
						let next_billing_date = extraction.next_billing_date
							? new Date(extraction.next_billing_date)
							: null;

						// Vendor-first service resolution: group by canonical vendor when
						// known; fall back to sender domain (unknown-vendor + the existing
						// one-service-per-domain constraint).
						const vendorName = extraction.vendor_name;
						const now = new Date();

						let service = vendorName
							? (
									await db
										.select({ id: schema.services.id })
										.from(schema.services)
										.where(
											and(
												eq(schema.services.owner_user_id, session.user.id),
												eq(schema.services.canonical_vendor_name, vendorName),
											),
										)
										.limit(1)
								)[0]
							: undefined;

						if (!service) {
							service = (
								await db
									.select({ id: schema.services.id })
									.from(schema.services)
									.where(
										and(
											eq(schema.services.owner_user_id, session.user.id),
											eq(schema.services.sender_domain, senderDomain),
										),
									)
									.limit(1)
							)[0];
						}

						let serviceId: string;
						if (service) {
							// Found existing — backfill canonical vendor if now known; bump counters.
							await db
								.update(schema.services)
								.set({
									...(vendorName ? { canonical_vendor_name: vendorName } : {}),
									email_count: sql`${schema.services.email_count} + 1`,
									last_email_at: now,
									updated_at: now,
								})
								.where(eq(schema.services.id, service.id));
							serviceId = service.id;
						} else {
							// New service — insert with both vendor + domain.
							const [inserted] = await db
								.insert(schema.services)
								.values({
									name: vendorName ?? senderDomain,
									owner_user_id: session.user.id,
									sender_domain: senderDomain,
									canonical_vendor_name: vendorName,
									email_count: 1,
									last_email_at: now,
								})
								.returning({ id: schema.services.id });
							if (!inserted) { skipped++; return; }
							serviceId = inserted.id;
						}

						// If the LLM didn't supply a next billing date, derive it from the
						// latest renewal event + known frequency. The current email counts
						// as a renewal anchor when its type is "renewal".
						if (!next_billing_date && extraction.frequency) {
							let latestRenewalAt: Date | null = emailType === "renewal" ? emailDate : null;

							const existingSub = await db
								.select({ id: schema.subscriptions.id })
								.from(schema.subscriptions)
								.where(
									and(
										eq(schema.subscriptions.user_id, session.user.id),
										eq(schema.subscriptions.service_id, serviceId),
									),
								)
								.limit(1);

							if (existingSub[0]) {
								const [renewal] = await db
									.select({ occurred_at: schema.subscription_events.occurred_at })
									.from(schema.subscription_events)
									.where(
										and(
											eq(schema.subscription_events.subscription_id, existingSub[0].id),
											eq(schema.subscription_events.event_type, "renewal"),
										),
									)
									.orderBy(desc(schema.subscription_events.occurred_at))
									.limit(1);
								if (
									renewal?.occurred_at &&
									(!latestRenewalAt || renewal.occurred_at.getTime() > latestRenewalAt.getTime())
								) {
									latestRenewalAt = renewal.occurred_at;
								}
							}

							if (latestRenewalAt) {
								next_billing_date = computeNextBillingDate(latestRenewalAt, extraction.frequency);
								console.log(`[msg:${id}] derived next_billing_date from renewal+${extraction.frequency}`);
							}
						}

						const latest = await db
							.select({ price_cents: schema.subscriptions.price_cents })
							.from(schema.subscriptions)
							.where(eq(schema.subscriptions.service_id, serviceId))
							.orderBy(desc(schema.subscriptions.created_at))
							.limit(1);

						const amountChanged = latest[0] != null && latest[0].price_cents !== price_cents;

						const [sub] = await db
							.insert(schema.subscriptions)
							.values({
								user_id: session.user.id,
								service_id: serviceId,
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
									vendor_name: sql`coalesce(excluded.vendor_name, ${schema.subscriptions.vendor_name})`,
									price_cents: sql`coalesce(excluded.price_cents, ${schema.subscriptions.price_cents})`,
									currency: sql`coalesce(excluded.currency, ${schema.subscriptions.currency})`,
									billing_frequency: sql`coalesce(excluded.billing_frequency, ${schema.subscriptions.billing_frequency})`,
									next_billing_date: sql`coalesce(excluded.next_billing_date, ${schema.subscriptions.next_billing_date})`,
									category: sql`coalesce(excluded.category, ${schema.subscriptions.category})`,
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
				price_cents: schema.subscriptions.price_cents,
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
					amount_cents: schema.subscription_events.amount_cents,
				})
				.from(schema.subscription_events)
				.where(inArray(schema.subscription_events.subscription_id, subIds))
				.orderBy(desc(schema.subscription_events.occurred_at));

			// Pick latest event per subscription in JS (already sorted DESC)
			const latestEventMap = new Map<string, { event_type: string; occurred_at: Date | null }>();
			// Latest non-null amount per subscription (events carry amount_cents but
			// no currency, so price is reconciled from events while currency stays
			// on the subscription row).
			const latestAmountMap = new Map<string, number>();
			for (const event of allEvents) {
				if (!latestEventMap.has(event.subscription_id)) {
					latestEventMap.set(event.subscription_id, {
						event_type: event.event_type,
						occurred_at: event.occurred_at,
					});
				}
				if (event.amount_cents != null && !latestAmountMap.has(event.subscription_id)) {
					latestAmountMap.set(event.subscription_id, event.amount_cents);
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

					// Derive price from the latest non-null amount event.
					const derivedPrice = latestAmountMap.get(sub.id);
					const priceChanged = derivedPrice != null && derivedPrice !== sub.price_cents;

					const statusUnchanged =
						derived === sub.status && derivedEmailType === sub.email_type;
					if (statusUnchanged && !priceChanged) return Promise.resolve();

					return db
						.update(schema.subscriptions)
						.set({
							status: derived,
							email_type: derivedEmailType,
							...(priceChanged ? { price_cents: derivedPrice } : {}),
							updated_at: new Date(),
						})
						.where(eq(schema.subscriptions.id, sub.id));
				}),
			);
		}

		// Persist the new history cursor once the scan is complete (a delta run,
		// or the final page of a full scan). getProfile gives the mailbox's
		// current historyId to start the next delta from.
		if (isScanComplete) {
			const { historyId } = await getProfile(accessToken, constants.GMAIL_API_BASE);
			const now = new Date();
			await db
				.insert(schema.user_scan_state)
				.values({ user_id: session.user.id, last_history_id: historyId, last_scanned_at: now })
				.onConflictDoUpdate({
					target: schema.user_scan_state.user_id,
					set: { last_history_id: historyId, last_scanned_at: now },
				});
			console.log(`[scan] saved historyId=${historyId} path=${path}`);
		}

		return Response.json({ processed, skipped, ...(nextPageToken && { nextPageToken }) });
	} catch (err) {
		console.error("Gmail scan error:", err);
		return new Response("Gmail fetch failed", { status: 502 });
	}
}

function computeNextBillingDate(latestRenewalAt: Date, frequency: string): Date {
	const d = new Date(latestRenewalAt);
	if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
	else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
	else if (frequency === "weekly") d.setDate(d.getDate() + 7);
	return d;
}
