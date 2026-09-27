CREATE TABLE `companion_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companion_requests_unique_ask` ON `companion_requests` (`event_id`,`from_user_id`,`to_user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);