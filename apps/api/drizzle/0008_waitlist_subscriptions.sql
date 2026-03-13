CREATE TABLE `waitlist_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_subscriptions_email_unique` ON `waitlist_subscriptions` (`email`);
--> statement-breakpoint
CREATE INDEX `waitlist_subscriptions_created_at_idx` ON `waitlist_subscriptions` (`created_at`);
