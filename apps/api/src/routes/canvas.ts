import { canvasSchemas, getCanvasTitleKey } from '@ai-canvas/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, like } from 'drizzle-orm';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createDb } from '../lib/db/client';
import { canvases } from '../lib/db/schema';
import { logApiEvent } from '../lib/observability';
import {
	deleteCanvasFromR2,
	loadCanvasFromR2,
	loadThumbnailFromR2,
	saveCanvasToR2,
	saveThumbnailToR2,
} from '../lib/storage/canvas-storage';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

const canvasSelect = {
	id: canvases.id,
	userId: canvases.userId,
	title: canvases.title,
	description: canvases.description,
	r2Key: canvases.r2Key,
	thumbnailUrl: canvases.thumbnailUrl,
	isPublic: canvases.isPublic,
	isFavorite: canvases.isFavorite,
	createdAt: canvases.createdAt,
	updatedAt: canvases.updatedAt,
} as const;

function withVersionedThumbnailUrl<T extends { thumbnailUrl: string | null; updatedAt: Date }>(
	canvas: T,
) {
	return {
		...canvas,
		thumbnailUrl: canvas.thumbnailUrl
			? `${canvas.thumbnailUrl}?v=${canvas.updatedAt.getTime()}`
			: undefined,
	};
}

function isUniqueCanvasTitleError(error: unknown): boolean {
	return error instanceof Error && error.message.includes('canvases_user_normalized_title_unique');
}

export const canvasRoutes = new Hono<AppEnv>()
	.use(requireAuth)

	// List canvases
	.get('/list', zValidator('query', canvasSchemas.list), async (c) => {
		const { limit, search, cursor } = c.req.valid('query');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const conditions = [eq(canvases.userId, user.id)];
		if (search) {
			conditions.push(like(canvases.title, `%${search}%`));
		}

		const results = await db
			.select(canvasSelect)
			.from(canvases)
			.where(and(...conditions))
			.orderBy(desc(canvases.updatedAt))
			.limit(limit + 1);

		const hasMore = results.length > limit;
		const items = (hasMore ? results.slice(0, limit) : results).map(withVersionedThumbnailUrl);

		return c.json({
			items,
			nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
		});
	})

	// Create canvas
	.post('/create', zValidator('json', canvasSchemas.create), async (c) => {
		const data = c.req.valid('json');
		const user = c.get('user');
		const db = createDb(c.env.DB);
		const normalizedTitle = getCanvasTitleKey(data.title);

		const existingCanvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.userId, user.id), eq(canvases.normalizedTitle, normalizedTitle)),
			columns: { id: true },
		});

		if (existingCanvas) {
			return c.json({ error: 'You already have a canvas with that name.' }, 409);
		}

		const id = nanoid();
		const r2Key = await saveCanvasToR2(c.env.R2, user.id, id, {
			elements: [],
			appState: {},
			files: {},
		});

		try {
			const [canvas] = await db
				.insert(canvases)
				.values({
					id,
					userId: user.id,
					title: data.title,
					normalizedTitle,
					description: data.description,
					isPublic: data.isPublic,
					r2Key,
				})
				.returning(canvasSelect);

			logApiEvent('info', 'canvas.created', { userId: user.id, canvasId: id });
			return c.json(withVersionedThumbnailUrl(canvas), 201);
		} catch (error) {
			if (isUniqueCanvasTitleError(error)) {
				return c.json({ error: 'You already have a canvas with that name.' }, 409);
			}
			logApiEvent('error', 'canvas.create_failed', {
				userId: user.id,
				canvasId: id,
				message: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	})

	.post('/:id/thumbnail', async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
			columns: { id: true },
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		const body = await c.req.arrayBuffer();
		if (body.byteLength === 0) {
			return c.json({ error: 'Empty body' }, 400);
		}

		if (body.byteLength > 2 * 1024 * 1024) {
			return c.json({ error: 'Thumbnail too large (max 2MB)' }, 400);
		}

		await saveThumbnailToR2(c.env.R2, user.id, id, body);

		const thumbnailUrl = `/api/canvas/${id}/thumbnail`;
		// Also update updatedAt so the versioned thumbnail URL (?v=<timestamp>) changes,
		// which busts the CanvasPreviewThumbnail React Query cache on the dashboard.
		await db
			.update(canvases)
			.set({ thumbnailUrl, updatedAt: new Date() })
			.where(eq(canvases.id, id));

		return c.json({ thumbnailUrl });
	})

	.get('/:id/thumbnail', async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
			columns: { id: true },
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		const object = await loadThumbnailFromR2(c.env.R2, user.id, id);
		if (!object) return c.json({ error: 'No thumbnail' }, 404);

		return new Response(object.body, {
			status: 200,
			headers: {
				'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
				'Cache-Control': object.httpMetadata?.cacheControl ?? 'private, max-age=300',
			},
		});
	})

	// Get canvas
	.get('/:id', async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		const data = await loadCanvasFromR2(c.env.R2, user.id, id);
		return c.json({ canvas: withVersionedThumbnailUrl(canvas), data });
	})

	.patch('/:id/meta', zValidator('json', canvasSchemas.update), async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);
		const body = c.req.valid('json');

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		const nextTitle = body.title ?? canvas.title;
		const nextNormalizedTitle = getCanvasTitleKey(nextTitle);

		if (nextNormalizedTitle !== canvas.normalizedTitle) {
			const duplicate = await db.query.canvases.findFirst({
				where: and(eq(canvases.userId, user.id), eq(canvases.normalizedTitle, nextNormalizedTitle)),
				columns: { id: true },
			});

			if (duplicate) {
				return c.json({ error: 'You already have a canvas with that name.' }, 409);
			}
		}

		try {
			const [updated] = await db
				.update(canvases)
				.set({
					...(body.title !== undefined
						? { title: body.title, normalizedTitle: nextNormalizedTitle }
						: {}),
					...(body.description !== undefined ? { description: body.description } : {}),
					...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
					updatedAt: new Date(),
				})
				.where(eq(canvases.id, id))
				.returning(canvasSelect);

			return c.json(withVersionedThumbnailUrl(updated));
		} catch (error) {
			if (isUniqueCanvasTitleError(error)) {
				return c.json({ error: 'You already have a canvas with that name.' }, 409);
			}
			logApiEvent('error', 'canvas.update_failed', {
				userId: user.id,
				canvasId: id,
				message: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	})

	// Save canvas (auto-save)
	.put('/:id', zValidator('json', canvasSchemas.data), async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);
		const body = c.req.valid('json');

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		await saveCanvasToR2(c.env.R2, user.id, id, {
			...body,
			files: body.files ?? {},
		});

		await db
			.update(canvases)
			.set({ updatedAt: new Date(), version: canvas.version + 1 })
			.where(eq(canvases.id, id));

		logApiEvent('info', 'canvas.saved', { userId: user.id, canvasId: id });
		return c.json({ success: true });
	})

	// Delete canvas
	.delete('/:id', async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		await deleteCanvasFromR2(c.env.R2, user.id, id);
		await db.delete(canvases).where(eq(canvases.id, id));

		logApiEvent('info', 'canvas.deleted', { userId: user.id, canvasId: id });
		return c.json({ success: true });
	})

	// Toggle favorite
	.post('/:id/favorite', async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);

		await db.update(canvases).set({ isFavorite: !canvas.isFavorite }).where(eq(canvases.id, id));

		return c.json({ isFavorite: !canvas.isFavorite });
	});
