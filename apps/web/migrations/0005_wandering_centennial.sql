ALTER TABLE `bookmarks` ADD `link_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `link_checked_at` integer;--> statement-breakpoint
CREATE INDEX `bookmarks_link_checked_idx` ON `bookmarks` (`link_checked_at`);