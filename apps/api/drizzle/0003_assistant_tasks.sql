CREATE TABLE `assistant_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`title` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `assistant_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_tasks_run_id_idx` ON `assistant_tasks` (`run_id`);
--> statement-breakpoint
CREATE INDEX `assistant_tasks_status_idx` ON `assistant_tasks` (`status`);
