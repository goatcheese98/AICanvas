CREATE TABLE `canvas_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`shared_with_user_id` text,
	`share_token` text,
	`permission` text DEFAULT 'view' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_shares_share_token_unique` ON `canvas_shares` (`share_token`);--> statement-breakpoint
CREATE TABLE `canvas_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`r2_key` text NOT NULL,
	`thumbnail_url` text,
	`is_public` integer DEFAULT false NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `canvases_user_id_idx` ON `canvases` (`user_id`);--> statement-breakpoint
CREATE INDEX `canvases_is_public_idx` ON `canvases` (`is_public`);--> statement-breakpoint
CREATE INDEX `canvases_created_at_idx` ON `canvases` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);