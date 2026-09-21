CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_base_url` text,
	`ai_api_key` text,
	`ai_model` text,
	`updated_at` integer NOT NULL
);
