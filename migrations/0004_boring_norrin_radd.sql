ALTER TABLE `subscription_events` ADD `amount_cents` integer;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `vendor_name` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billing_frequency` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `next_billing_date` integer;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `category` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `email_type` text;