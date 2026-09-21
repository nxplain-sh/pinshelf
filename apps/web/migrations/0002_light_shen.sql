CREATE TABLE `bookmark_tags` (
	`bookmark_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`bookmark_id`, `tag_id`),
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_tags_tag_idx` ON `bookmark_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_name_key_unique` ON `collections` (`name_key`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_key_unique` ON `tags` (`name_key`);--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `collection_id` text REFERENCES collections(id);--> statement-breakpoint
CREATE INDEX `bookmarks_collection_idx` ON `bookmarks` (`collection_id`);