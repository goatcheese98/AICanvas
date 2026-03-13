import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	avatarUrl: text('avatar_url'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const canvases = sqliteTable(
	'canvases',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		title: text('title').notNull(),
		normalizedTitle: text('normalized_title').notNull(),
		description: text('description'),
		r2Key: text('r2_key').notNull(),
		thumbnailUrl: text('thumbnail_url'),
		isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
		isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
		version: integer('version').notNull().default(1),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('canvases_user_id_idx').on(table.userId),
		index('canvases_is_public_idx').on(table.isPublic),
		index('canvases_created_at_idx').on(table.createdAt),
		uniqueIndex('canvases_user_normalized_title_unique').on(table.userId, table.normalizedTitle),
	],
);

export const canvasVersions = sqliteTable('canvas_versions', {
	id: text('id').primaryKey(),
	canvasId: text('canvas_id')
		.notNull()
		.references(() => canvases.id),
	r2Key: text('r2_key').notNull(),
	version: integer('version').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const canvasShares = sqliteTable('canvas_shares', {
	id: text('id').primaryKey(),
	canvasId: text('canvas_id')
		.notNull()
		.references(() => canvases.id),
	sharedWithUserId: text('shared_with_user_id'),
	shareToken: text('share_token').unique(),
	permission: text('permission', { enum: ['view', 'edit'] })
		.notNull()
		.default('view'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const waitlistSubscriptions = sqliteTable(
	'waitlist_subscriptions',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		source: text('source', { enum: ['landing-hero', 'landing-footer'] }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		uniqueIndex('waitlist_subscriptions_email_unique').on(table.email),
		index('waitlist_subscriptions_created_at_idx').on(table.createdAt),
	],
);

export const assistantThreads = sqliteTable(
	'assistant_threads',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		canvasId: text('canvas_id')
			.notNull()
			.references(() => canvases.id),
		title: text('title').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('assistant_threads_user_id_idx').on(table.userId),
		index('assistant_threads_canvas_id_idx').on(table.canvasId),
		index('assistant_threads_updated_at_idx').on(table.updatedAt),
	],
);

export const assistantRuns = sqliteTable(
	'assistant_runs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		threadId: text('thread_id').references(() => assistantThreads.id),
		requestCanvasId: text('request_canvas_id'),
		status: text('status', {
			enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
		})
			.notNull()
			.default('queued'),
		requestMessage: text('request_message').notNull(),
		contextMode: text('context_mode', { enum: ['all', 'selected', 'none'] }).notNull(),
		modeHint: text('mode_hint', {
			enum: ['chat', 'mermaid', 'd2', 'image', 'sketch', 'kanban', 'prototype'],
		}),
		requestHistoryJson: text('request_history_json'),
		selectedElementIdsJson: text('selected_element_ids_json'),
		prototypeContextJson: text('prototype_context_json'),
		contextSnapshotJson: text('context_snapshot_json'),
		resultMessageJson: text('result_message_json'),
		error: text('error'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('assistant_runs_user_id_idx').on(table.userId),
		index('assistant_runs_thread_id_idx').on(table.threadId),
		index('assistant_runs_status_idx').on(table.status),
		index('assistant_runs_created_at_idx').on(table.createdAt),
	],
);

export const assistantRunEvents = sqliteTable(
	'assistant_run_events',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => assistantRuns.id),
		sequence: integer('sequence').notNull(),
		type: text('type', {
			enum: [
				'run.created',
				'run.started',
				'task.created',
				'task.started',
				'task.completed',
				'task.failed',
				'message.created',
				'run.completed',
				'run.failed',
			],
		}).notNull(),
		dataJson: text('data_json'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('assistant_run_events_run_id_idx').on(table.runId),
		uniqueIndex('assistant_run_events_run_sequence_unique').on(table.runId, table.sequence),
	],
);

export const assistantTasks = sqliteTable(
	'assistant_tasks',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => assistantRuns.id),
		type: text('type', {
			enum: [
				'plan_run',
				'generate_response',
				'generate_image',
				'vectorize_asset',
				'create_markdown_overlay',
				'place_canvas_artifact',
				'verify_layout',
				'verify_run',
			],
		}).notNull(),
		status: text('status', {
			enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
		})
			.notNull()
			.default('queued'),
		title: text('title').notNull(),
		inputJson: text('input_json'),
		outputJson: text('output_json'),
		error: text('error'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('assistant_tasks_run_id_idx').on(table.runId),
		index('assistant_tasks_status_idx').on(table.status),
	],
);

export const assistantArtifacts = sqliteTable(
	'assistant_artifacts',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => assistantRuns.id),
		taskId: text('task_id')
			.notNull()
			.references(() => assistantTasks.id),
		type: text('type', {
			enum: [
				'mermaid',
				'd2',
				'image',
				'image-vector',
				'kanban-ops',
				'kanban-patch',
				'prototype-files',
				'markdown',
				'markdown-patch',
				'layout-plan',
			],
		}).notNull(),
		title: text('title').notNull(),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('assistant_artifacts_run_id_idx').on(table.runId),
		index('assistant_artifacts_task_id_idx').on(table.taskId),
	],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	canvases: many(canvases),
	assistantThreads: many(assistantThreads),
	assistantRuns: many(assistantRuns),
}));

export const canvasesRelations = relations(canvases, ({ one, many }) => ({
	owner: one(users, { fields: [canvases.userId], references: [users.id] }),
	versions: many(canvasVersions),
	shares: many(canvasShares),
	assistantThreads: many(assistantThreads),
}));

export const canvasVersionsRelations = relations(canvasVersions, ({ one }) => ({
	canvas: one(canvases, { fields: [canvasVersions.canvasId], references: [canvases.id] }),
}));

export const canvasSharesRelations = relations(canvasShares, ({ one }) => ({
	canvas: one(canvases, { fields: [canvasShares.canvasId], references: [canvases.id] }),
}));

export const assistantThreadsRelations = relations(assistantThreads, ({ one, many }) => ({
	user: one(users, { fields: [assistantThreads.userId], references: [users.id] }),
	canvas: one(canvases, { fields: [assistantThreads.canvasId], references: [canvases.id] }),
	runs: many(assistantRuns),
}));

export const assistantRunsRelations = relations(assistantRuns, ({ one, many }) => ({
	user: one(users, { fields: [assistantRuns.userId], references: [users.id] }),
	thread: one(assistantThreads, { fields: [assistantRuns.threadId], references: [assistantThreads.id] }),
	events: many(assistantRunEvents),
	tasks: many(assistantTasks),
	artifacts: many(assistantArtifacts),
}));

export const assistantRunEventsRelations = relations(assistantRunEvents, ({ one }) => ({
	run: one(assistantRuns, { fields: [assistantRunEvents.runId], references: [assistantRuns.id] }),
}));

export const assistantTasksRelations = relations(assistantTasks, ({ one }) => ({
	run: one(assistantRuns, { fields: [assistantTasks.runId], references: [assistantRuns.id] }),
}));

export const assistantArtifactsRelations = relations(assistantArtifacts, ({ one }) => ({
	run: one(assistantRuns, { fields: [assistantArtifacts.runId], references: [assistantRuns.id] }),
	task: one(assistantTasks, { fields: [assistantArtifacts.taskId], references: [assistantTasks.id] }),
}));
