CREATE TABLE `assistant_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`canvas_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_threads_user_id_idx` ON `assistant_threads` (`user_id`);
--> statement-breakpoint
CREATE INDEX `assistant_threads_canvas_id_idx` ON `assistant_threads` (`canvas_id`);
--> statement-breakpoint
CREATE INDEX `assistant_threads_updated_at_idx` ON `assistant_threads` (`updated_at`);
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD `thread_id` text REFERENCES `assistant_threads`(`id`);
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD `request_history_json` text;
--> statement-breakpoint
ALTER TABLE `assistant_runs` ADD `prototype_context_json` text;
--> statement-breakpoint
CREATE INDEX `assistant_runs_thread_id_idx` ON `assistant_runs` (`thread_id`);
