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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	canvases: many(canvases),
}));

export const canvasesRelations = relations(canvases, ({ one, many }) => ({
	owner: one(users, { fields: [canvases.userId], references: [users.id] }),
	versions: many(canvasVersions),
	shares: many(canvasShares),
}));

export const canvasVersionsRelations = relations(canvasVersions, ({ one }) => ({
	canvas: one(canvases, { fields: [canvasVersions.canvasId], references: [canvases.id] }),
}));

export const canvasSharesRelations = relations(canvasShares, ({ one }) => ({
	canvas: one(canvases, { fields: [canvasShares.canvasId], references: [canvases.id] }),
}));
