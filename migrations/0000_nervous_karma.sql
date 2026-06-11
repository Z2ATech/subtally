CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_services_owner` ON `services` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_services_owner_name` ON `services` (`owner_user_id`,`name`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000),
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_events_subscription` ON `subscription_events` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_subscription_events_type` ON `subscription_events` (`event_type`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`plan` text,
	`price_cents` integer,
	`currency` text DEFAULT 'USD',
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000),
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_subscriptions_status" CHECK("subscriptions"."status" in ('active', 'cancelled', 'expired')),
	CONSTRAINT "chk_subscriptions_price_cents" CHECK("subscriptions"."price_cents" is null or "subscriptions"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_subscriptions_user` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_service` ON `subscriptions` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_subscriptions_active` ON `subscriptions` (`user_id`,`service_id`) WHERE status = 'active';--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
