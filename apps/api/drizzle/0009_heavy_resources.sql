CREATE TABLE `heavy_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`title` text NOT NULL,
	`data_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `heavy_resources_canvas_id_idx` ON `heavy_resources` (`canvas_id`);
--> statement-breakpoint
CREATE INDEX `heavy_resources_canvas_id_resource_type_idx` ON `heavy_resources` (`canvas_id`,`resource_type`);
