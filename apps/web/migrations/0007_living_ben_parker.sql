CREATE TABLE `saved_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`query` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`bookmark_id` text NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_bookmark_idx` ON `share_links` (`bookmark_id`);--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `archive_key` text;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `archive_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `backup_retention` integer DEFAULT 30 NOT NULL;