CREATE TABLE `assistant_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `assistant_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `assistant_tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_artifacts_run_id_idx` ON `assistant_artifacts` (`run_id`);
--> statement-breakpoint
CREATE INDEX `assistant_artifacts_task_id_idx` ON `assistant_artifacts` (`task_id`);
