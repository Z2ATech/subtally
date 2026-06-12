import type { Env } from "../../index";
import type { createAuth } from "../auth";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { checkRateLimit } from "../lib/ratelimit";

const STATUSES = ["active", "cancelled", "expired", "detected", "unknown"] as const;
type SubscriptionStatus = (typeof STATUSES)[number];

type SubscriptionRow = {
	id: string;
	vendor_name: string | null;
	plan: string | null;
	price_cents: number | null;
	currency: string | null;
	billing_frequency: string | null;
	next_billing_date: Date | null;
	category: string | null;
	email_type: string | null;
	status: SubscriptionStatus;
	started_at: Date | null;
	ended_at: Date | null;
	service_id: string;
	service_name: string;
	service_sender_domain: string | null;
	service_email_count: number;
	service_last_email_at: Date | null;
};

export async function handleReadRoutes(
	request: Request,
	env: Env,
	auth: ReturnType<typeof createAuth>,
): Promise<Response> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return jsonError("Unauthorized", 401);

	const rateLimitResponse = await checkRateLimit(env.RATE_LIMITER, session.user.id);
	if (rateLimitResponse) return rateLimitResponse;

	if (request.method !== "GET") return jsonError("Method Not Allowed", 405);

	const db = drizzle(env.DB);
	const url = new URL(request.url);
	const pathname = normalizePath(url.pathname);

	if (pathname === "/api/subscriptions") {
		const statusParam = url.searchParams.get("status") as typeof schema.subscriptions.status.enumValues[number] | null;
		const serviceId = url.searchParams.get("service_id");

		if (statusParam && !isSubscriptionStatus(statusParam)) {
			return jsonError("Invalid status", 400);
		}

		const conditions: SQL[] = [];
		if (statusParam) conditions.push(eq(schema.subscriptions.status, statusParam));
		if (serviceId) conditions.push(eq(schema.subscriptions.service_id, serviceId));

		const rows = await subscriptionSelect(db, session.user.id, and(...conditions))
			.orderBy(desc(schema.subscriptions.updated_at));

		return Response.json(rows.map(mapSubscription));
	}

	if (pathname.startsWith("/api/subscriptions/")) {
		const id = decodeURIComponent(pathname.slice("/api/subscriptions/".length));
		if (!id || id.includes("/")) return jsonError("Not Found", 404);

		const rows = await subscriptionSelect(db, session.user.id, eq(schema.subscriptions.id, id))
			.limit(1);

		if (!rows[0]) return jsonError("Not Found", 404);

		const events = await db
			.select({
				id: schema.subscription_events.id,
				event_type: schema.subscription_events.event_type,
				amount_cents: schema.subscription_events.amount_cents,
				occurred_at: schema.subscription_events.occurred_at,
			})
			.from(schema.subscription_events)
			.where(eq(schema.subscription_events.subscription_id, rows[0].id))
			.orderBy(desc(schema.subscription_events.occurred_at));

		return Response.json({
			...mapSubscription(rows[0]),
			events: events.map((event) => ({
				id: event.id,
				event_type: event.event_type,
				amount_cents: event.amount_cents,
				occurred_at: toIso(event.occurred_at),
			})),
		});
	}

	if (pathname === "/api/services") {
		const rows = await db
			.select({
				id: schema.services.id,
				name: schema.services.name,
				sender_domain: schema.services.sender_domain,
				email_count: schema.services.email_count,
				last_email_at: schema.services.last_email_at,
				created_at: schema.services.created_at,
				active_subscription_count: sql<number>`count(${schema.subscriptions.id})`,
			})
			.from(schema.services)
			.leftJoin(
				schema.subscriptions,
				and(
					eq(schema.subscriptions.service_id, schema.services.id),
					eq(schema.subscriptions.user_id, session.user.id),
					eq(schema.subscriptions.status, "active"),
				),
			)
			.where(eq(schema.services.owner_user_id, session.user.id))
			.groupBy(
				schema.services.id,
				schema.services.name,
				schema.services.sender_domain,
				schema.services.email_count,
				schema.services.last_email_at,
				schema.services.created_at,
			)
			.orderBy(asc(schema.services.name));

		return Response.json(
			rows.map((row) => ({
				id: row.id,
				name: row.name,
				sender_domain: row.sender_domain,
				email_count: row.email_count,
				last_email_at: toIso(row.last_email_at),
				created_at: toIso(row.created_at),
				active_subscription_count: Number(row.active_subscription_count ?? 0),
			})),
		);
	}

	if (pathname === "/api/upcoming") {
		const nowMs = Date.now();
		const inThirtyDaysMs = nowMs + 30 * 24 * 60 * 60 * 1000;

		const rows = await subscriptionSelect(
			db,
			session.user.id,
			and(
				eq(schema.subscriptions.status, "active"),
				gte(schema.subscriptions.next_billing_date, sql`${nowMs}`),
				lte(schema.subscriptions.next_billing_date, sql`${inThirtyDaysMs}`),
			),
		)
			.orderBy(asc(schema.subscriptions.next_billing_date));

		return Response.json(rows.map(mapSubscription));
	}

	if (pathname === "/api/stats") {
		const nowMs = Date.now();
		const inThirtyDaysMs = nowMs + 30 * 24 * 60 * 60 * 1000;

		const [subscriptionStats] = await db
			.select({
				active_count: sql<number>`coalesce(sum(case when ${schema.subscriptions.status} = 'active' then 1 else 0 end), 0)`,
				monthly_spend: sql<number>`coalesce(sum(case when ${schema.subscriptions.status} = 'active' then coalesce(${schema.subscriptions.price_cents}, 0) else 0 end), 0)`,
				upcoming_count: sql<number>`coalesce(sum(case when ${schema.subscriptions.status} = 'active' and ${schema.subscriptions.next_billing_date} >= ${nowMs} and ${schema.subscriptions.next_billing_date} <= ${inThirtyDaysMs} then 1 else 0 end), 0)`,
			})
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.user_id, session.user.id));

		const [scanStats] = await db
			.select({
				last_scan_at: sql<number | null>`max(${schema.processed_emails.created_at})`,
			})
			.from(schema.processed_emails)
			.where(eq(schema.processed_emails.user_id, session.user.id));

		return Response.json({
			active_count: Number(subscriptionStats?.active_count ?? 0),
			monthly_spend: Number(subscriptionStats?.monthly_spend ?? 0),
			upcoming_count: Number(subscriptionStats?.upcoming_count ?? 0),
			last_scan_at: toIso(scanStats?.last_scan_at ?? null),
		});
	}

	return jsonError("Not Found", 404);
}

function subscriptionSelect(
	db: ReturnType<typeof drizzle>,
	userId: string,
	condition?: SQL,
) {
	return db
		.select({
			id: schema.subscriptions.id,
			vendor_name: schema.subscriptions.vendor_name,
			plan: schema.subscriptions.plan,
			price_cents: schema.subscriptions.price_cents,
			currency: schema.subscriptions.currency,
			billing_frequency: schema.subscriptions.billing_frequency,
			next_billing_date: schema.subscriptions.next_billing_date,
			category: schema.subscriptions.category,
			email_type: schema.subscriptions.email_type,
			status: schema.subscriptions.status,
			started_at: schema.subscriptions.started_at,
			ended_at: schema.subscriptions.ended_at,
			service_id: schema.services.id,
			service_name: schema.services.name,
			service_sender_domain: schema.services.sender_domain,
			service_email_count: schema.services.email_count,
			service_last_email_at: schema.services.last_email_at,
		})
		.from(schema.subscriptions)
		.innerJoin(schema.services, eq(schema.subscriptions.service_id, schema.services.id))
		.where(and(eq(schema.subscriptions.user_id, userId), condition));
}

function mapSubscription(row: SubscriptionRow) {
	return {
		id: row.id,
		vendor_name: row.vendor_name,
		plan: row.plan,
		price_cents: row.price_cents,
		currency: row.currency,
		billing_frequency: row.billing_frequency,
		next_billing_date: toIso(row.next_billing_date),
		category: row.category,
		email_type: row.email_type,
		status: row.status,
		started_at: toIso(row.started_at),
		ended_at: toIso(row.ended_at),
		service: {
			id: row.service_id,
			name: row.service_name,
			sender_domain: row.service_sender_domain,
			email_count: row.service_email_count,
			last_email_at: toIso(row.service_last_email_at),
		},
	};
}

function jsonError(error: string, status: number): Response {
	return Response.json({ error }, { status });
}

function normalizePath(pathname: string): string {
	if (pathname === "/") return pathname;
	return pathname.replace(/\/+$/, "");
}

function isSubscriptionStatus(value: string): value is SubscriptionStatus {
	return STATUSES.includes(value as SubscriptionStatus);
}

function toIso(value: Date | number | string | null | undefined): string | null {
	if (value == null) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
