CREATE TABLE `assistant_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`request_message` text NOT NULL,
	`context_mode` text NOT NULL,
	`mode_hint` text,
	`result_message_json` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_runs_user_id_idx` ON `assistant_runs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `assistant_runs_status_idx` ON `assistant_runs` (`status`);
--> statement-breakpoint
CREATE INDEX `assistant_runs_created_at_idx` ON `assistant_runs` (`created_at`);
--> statement-breakpoint
CREATE TABLE `assistant_run_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`data_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `assistant_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_run_events_run_id_idx` ON `assistant_run_events` (`run_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistant_run_events_run_sequence_unique` ON `assistant_run_events` (`run_id`, `sequence`);
