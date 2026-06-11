CREATE TABLE `processed_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_processed_emails_user_checksum` ON `processed_emails` (`user_id`,`checksum`);--> statement-breakpoint
DROP INDEX `subscriptions_checksum_unique`;--> statement-breakpoint
DROP INDEX `uniq_subscriptions_active`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_subscriptions_user_service` ON `subscriptions` (`user_id`,`service_id`);--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `checksum`;