CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`url_hash` text NOT NULL,
	`title` text,
	`description` text,
	`notes` text,
	`site_name` text,
	`favicon_url` text,
	`og_image_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata_status` text DEFAULT 'pending' NOT NULL,
	`metadata_attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_url_hash_unique` ON `bookmarks` (`url_hash`);--> statement-breakpoint
CREATE INDEX `bookmarks_status_created_idx` ON `bookmarks` (`status`,`created_at`);