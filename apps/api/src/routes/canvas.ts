import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc, and, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { canvasSchemas, getCanvasTitleKey } from '@ai-canvas/shared/schemas';
import { requireAuth } from '../middleware/auth';
import { createDb } from '../lib/db/client';
import { canvases } from '../lib/db/schema';
import { saveCanvasToR2, loadCanvasFromR2, deleteCanvasFromR2 } from '../lib/storage/canvas-storage';
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
		const items = hasMore ? results.slice(0, limit) : results;

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

			return c.json(canvas, 201);
		} catch (error) {
			if (isUniqueCanvasTitleError(error)) {
				return c.json({ error: 'You already have a canvas with that name.' }, 409);
			}
			throw error;
		}
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
		return c.json({ canvas, data });
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
				where: and(
					eq(canvases.userId, user.id),
					eq(canvases.normalizedTitle, nextNormalizedTitle),
				),
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

			return c.json(updated);
		} catch (error) {
			if (isUniqueCanvasTitleError(error)) {
				return c.json({ error: 'You already have a canvas with that name.' }, 409);
			}
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

		await db
			.update(canvases)
			.set({ isFavorite: !canvas.isFavorite })
			.where(eq(canvases.id, id));

		return c.json({ isFavorite: !canvas.isFavorite });
	});
