ALTER TABLE `canvases` ADD `normalized_title` text DEFAULT '' NOT NULL;
--> statement-breakpoint
WITH ranked AS (
	SELECT
		`id`,
		trim(replace(replace(replace(`title`, char(13), ' '), char(10), ' '), char(9), ' ')) AS `base_title`,
		row_number() OVER (
			PARTITION BY `user_id`, lower(trim(replace(replace(replace(`title`, char(13), ' '), char(10), ' '), char(9), ' ')))
			ORDER BY `created_at`, `id`
		) AS `duplicate_index`
	FROM `canvases`
)
UPDATE `canvases`
SET
	`title` = (
		CASE
			WHEN (SELECT `duplicate_index` FROM ranked WHERE ranked.`id` = `canvases`.`id`) = 1 THEN
				(SELECT `base_title` FROM ranked WHERE ranked.`id` = `canvases`.`id`)
			ELSE
				(SELECT `base_title` FROM ranked WHERE ranked.`id` = `canvases`.`id`) ||
				' (' ||
				(SELECT `duplicate_index` FROM ranked WHERE ranked.`id` = `canvases`.`id`) ||
				')'
		END
	),
	`normalized_title` = lower(
		CASE
			WHEN (SELECT `duplicate_index` FROM ranked WHERE ranked.`id` = `canvases`.`id`) = 1 THEN
				(SELECT `base_title` FROM ranked WHERE ranked.`id` = `canvases`.`id`)
			ELSE
				(SELECT `base_title` FROM ranked WHERE ranked.`id` = `canvases`.`id`) ||
				' (' ||
				(SELECT `duplicate_index` FROM ranked WHERE ranked.`id` = `canvases`.`id`) ||
				')'
		END
	);
--> statement-breakpoint
CREATE UNIQUE INDEX `canvases_user_normalized_title_unique` ON `canvases` (`user_id`, `normalized_title`);
