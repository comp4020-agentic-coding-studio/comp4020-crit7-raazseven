CREATE TABLE `event_tags` (
	`event_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`event_id`, `tag_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`location` text NOT NULL,
	`category` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interests` (
	`user_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_label_unique` ON `tags` (`label`);--> statement-breakpoint
CREATE TABLE `user_tags` (
	`user_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
