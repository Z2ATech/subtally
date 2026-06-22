CREATE TABLE `user_scan_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_history_id` text,
	`last_scanned_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
