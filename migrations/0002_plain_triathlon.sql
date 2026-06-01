DROP TABLE `users`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_services`("id", "name", "description", "owner_user_id", "created_at", "updated_at") SELECT "id", "name", "description", "owner_user_id", "created_at", "updated_at" FROM `services`;--> statement-breakpoint
DROP TABLE `services`;--> statement-breakpoint
ALTER TABLE `__new_services` RENAME TO `services`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_services_owner` ON `services` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_services_owner_name` ON `services` (`owner_user_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
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
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_subscriptions_status" CHECK("__new_subscriptions"."status" in ('active', 'cancelled', 'expired')),
	CONSTRAINT "chk_subscriptions_price_cents" CHECK("__new_subscriptions"."price_cents" is null or "__new_subscriptions"."price_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_subscriptions`("id", "user_id", "service_id", "plan", "price_cents", "currency", "status", "started_at", "ended_at", "created_at", "updated_at") SELECT "id", "user_id", "service_id", "plan", "price_cents", "currency", "status", "started_at", "ended_at", "created_at", "updated_at" FROM `subscriptions`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;--> statement-breakpoint
CREATE INDEX `idx_subscriptions_user` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_service` ON `subscriptions` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_subscriptions_active` ON `subscriptions` (`user_id`,`service_id`) WHERE status = 'active';