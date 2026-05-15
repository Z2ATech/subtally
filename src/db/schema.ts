import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatar_url: text("avatar_url"),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
});

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    owner_user_id: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
    updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_services_owner").on(t.owner_user_id),
    uniqueIndex("uniq_services_owner_name").on(t.owner_user_id, t.name),
  ]
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    user_id: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    service_id: text("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
    plan: text("plan"),
    price_cents: integer("price_cents"),
    currency: text("currency").default("USD"),
    status: text("status", { enum: ["active", "cancelled", "expired"] }).notNull().default("active"),
    started_at: integer("started_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
    ended_at: integer("ended_at", { mode: "timestamp_ms" }),
    created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
    updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.user_id),
    index("idx_subscriptions_service").on(t.service_id),
    index("idx_subscriptions_status").on(t.status),
    uniqueIndex("uniq_subscriptions_active")
      .on(t.user_id, t.service_id)
      .where(sql`status = 'active'`),
    check("chk_subscriptions_status", sql`${t.status} in ('active', 'cancelled', 'expired')`),
  ]
);

export const subscription_events = sqliteTable(
  "subscription_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    subscription_id: text("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
    event_type: text("event_type").notNull(),
    payload: text("payload"),
    occurred_at: integer("occurred_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
    created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`).$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_subscription_events_subscription").on(t.subscription_id),
    index("idx_subscription_events_type").on(t.event_type),
  ]
);
