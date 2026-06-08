PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`plan` text,
	`price_cents` integer,
	`currency` text DEFAULT 'USD',
	`status` text DEFAULT 'active' NOT NULL,
	`checksum` text,
	`started_at` integer DEFAULT (unixepoch() * 1000),
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_subscriptions_status" CHECK("__new_subscriptions"."status" in ('active', 'cancelled', 'expired', 'detected')),
	CONSTRAINT "chk_subscriptions_price_cents" CHECK("__new_subscriptions"."price_cents" is null or "__new_subscriptions"."price_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_subscriptions`("id", "user_id", "service_id", "plan", "price_cents", "currency", "status", "checksum", "started_at", "ended_at", "created_at", "updated_at") SELECT "id", "user_id", "service_id", "plan", "price_cents", "currency", "status", "checksum", "started_at", "ended_at", "created_at", "updated_at" FROM `subscriptions`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_checksum_unique` ON `subscriptions` (`checksum`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_user` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_service` ON `subscriptions` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_subscriptions_active` ON `subscriptions` (`user_id`,`service_id`) WHERE status = 'active';--> statement-breakpoint
ALTER TABLE `services` ADD `sender_domain` text;--> statement-breakpoint
ALTER TABLE `services` ADD `email_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `last_email_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_services_owner_domain` ON `services` (`owner_user_id`,`sender_domain`);