import { CANVAS_DEFAULTS } from '@ai-canvas/shared/constants';
import { canvasSchemas, getCanvasTitleKey } from '@ai-canvas/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, like } from 'drizzle-orm';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { nanoid } from 'nanoid';
import { z, ZodError } from 'zod';
import { createDb } from '../lib/db/client';
import { canvases } from '../lib/db/schema';
import { logApiEvent } from '../lib/observability';
import {
	CanvasPayloadTooLargeError,
	deleteCanvasDataFromR2,
	deleteCanvasFromR2,
	deleteThumbnailFromR2,
	getCanvasR2Key,
	loadCanvasFromR2,
	loadThumbnailFromR2,
	saveCanvasToR2,
	saveThumbnailToR2,
} from '../lib/storage/canvas-storage';
import {
	deleteHeavyResourceRecord,
	getHeavyResourceRecord,
	saveHeavyResourceRecord,
} from '../lib/storage/heavy-resource-storage';
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
	version: canvases.version,
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

function getCanvasPayloadTooLargeMessage(): string {
	return `Canvas payload too large (max ${Math.floor(CANVAS_DEFAULTS.MAX_CANVAS_SIZE_BYTES / (1024 * 1024))}MB).`;
}

const enforceCanvasPayloadLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
	const contentLengthHeader = c.req.header('content-length');
	if (!contentLengthHeader) {
		await next();
		return;
	}

	const contentLength = Number.parseInt(contentLengthHeader, 10);
	if (Number.isFinite(contentLength) && contentLength > CANVAS_DEFAULTS.MAX_CANVAS_SIZE_BYTES) {
		return c.json({ error: getCanvasPayloadTooLargeMessage() }, 413);
	}

	await next();
};

const heavyResourceParamsSchema = z.object({
	id: z.string().min(1),
	resourceType: canvasSchemas.heavyResourceType,
	resourceId: z.string().min(1),
});

const heavyResourceUpsertSchema = z.object({
	title: z.string().trim().min(1).max(120),
	data: z.unknown(),
});

export const canvasRoutes = new Hono<AppEnv>()
	.use(requireAuth)

	// List canvases
	.get('/list', zValidator('query', canvasSchemas.list), async (c) => {
		const { limit, search } = c.req.valid('query');
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
		const r2Key = getCanvasR2Key(user.id, id);

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

			if (!canvas) {
				throw new Error('Failed to create canvas record');
			}

			try {
				await saveCanvasToR2(c.env.R2, user.id, id, {
					elements: [],
					appState: {},
					files: {},
				});
			} catch (error) {
				try {
					await db.delete(canvases).where(eq(canvases.id, id));
				} catch (rollbackError) {
					logApiEvent('error', 'canvas.create_rollback_failed', {
						userId: user.id,
						canvasId: id,
						message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
					});
				}

				logApiEvent('error', 'canvas.create_blob_failed', {
					userId: user.id,
					canvasId: id,
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}

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

		const previousThumbnail = await loadThumbnailFromR2(c.env.R2, user.id, id);
		const previousThumbnailData = previousThumbnail ? await previousThumbnail.arrayBuffer() : null;

		await saveThumbnailToR2(c.env.R2, user.id, id, body);

		const thumbnailUrl = `/api/canvas/${id}/thumbnail`;
		try {
			// Also update updatedAt so the versioned thumbnail URL (?v=<timestamp>) changes,
			// which busts the CanvasPreviewThumbnail React Query cache on the dashboard.
			await db
				.update(canvases)
				.set({ thumbnailUrl, updatedAt: new Date() })
				.where(eq(canvases.id, id));
		} catch (error) {
			try {
				if (previousThumbnailData) {
					await saveThumbnailToR2(c.env.R2, user.id, id, previousThumbnailData);
				} else {
					await deleteThumbnailFromR2(c.env.R2, user.id, id);
				}
			} catch (rollbackError) {
				logApiEvent('error', 'canvas.thumbnail_rollback_failed', {
					userId: user.id,
					canvasId: id,
					message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
				});
			}

			throw error;
		}

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

	.get('/:id/resources/:resourceType/:resourceId', zValidator('param', heavyResourceParamsSchema), async (c) => {
		const { id, resourceType, resourceId } = c.req.valid('param');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		const resource = await getHeavyResourceRecord(db, user.id, id, resourceType, resourceId);
		if (!resource) return c.json({ error: 'Not found' }, 404);

		return c.json(resource);
	})

	.put(
		'/:id/resources/:resourceType/:resourceId',
		zValidator('param', heavyResourceParamsSchema),
		zValidator('json', heavyResourceUpsertSchema),
		async (c) => {
			const { id, resourceType, resourceId } = c.req.valid('param');
			const body = c.req.valid('json');
			const user = c.get('user');
			const db = createDb(c.env.DB);

			try {
				const resource = await saveHeavyResourceRecord(db, user.id, {
					canvasId: id,
					resourceType,
					resourceId,
					title: body.title,
					data: body.data,
				});

				return c.json(resource);
			} catch (error) {
				if (error instanceof ZodError) {
					return c.json(
						{
							error: error.issues[0]?.message ?? 'Invalid heavy resource payload.',
						},
						400,
					);
				}

				throw error;
			}
		},
	)

	.delete(
		'/:id/resources/:resourceType/:resourceId',
		zValidator('param', heavyResourceParamsSchema),
		async (c) => {
			const { id, resourceType, resourceId } = c.req.valid('param');
			const user = c.get('user');
			const db = createDb(c.env.DB);

			const deleted = await deleteHeavyResourceRecord(db, user.id, id, resourceType, resourceId);
			if (!deleted) return c.json({ error: 'Not found' }, 404);

			return c.json({ success: true });
		},
	)

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
	.put('/:id', enforceCanvasPayloadLimit, zValidator('json', canvasSchemas.save), async (c) => {
		const id = c.req.param('id');
		const user = c.get('user');
		const db = createDb(c.env.DB);
		const body = c.req.valid('json');

		const canvas = await db.query.canvases.findFirst({
			where: and(eq(canvases.id, id), eq(canvases.userId, user.id)),
		});

		if (!canvas) return c.json({ error: 'Not found' }, 404);
		if (body.expectedVersion !== canvas.version) {
			return c.json(
				{
					error: 'Canvas has changed since your last sync. Refresh before saving again.',
					currentVersion: canvas.version,
				},
				409,
			);
		}

		const previousData = await loadCanvasFromR2(c.env.R2, user.id, id);
		let didWriteCanvas = false;

		try {
			await saveCanvasToR2(c.env.R2, user.id, id, {
				elements: body.elements,
				appState: body.appState,
				files: body.files ?? {},
			});
			didWriteCanvas = true;

			const nextVersion = body.expectedVersion + 1;
			const [updatedCanvas] = await db
				.update(canvases)
				.set({ updatedAt: new Date(), version: nextVersion })
				.where(and(eq(canvases.id, id), eq(canvases.version, body.expectedVersion)))
				.returning({ version: canvases.version });

			if (!updatedCanvas) {
				throw new Error('Canvas version conflict during save.');
			}

			logApiEvent('info', 'canvas.saved', { userId: user.id, canvasId: id });
			return c.json({ success: true, version: updatedCanvas.version });
		} catch (error) {
			if (didWriteCanvas) {
				try {
					if (previousData) {
						await saveCanvasToR2(c.env.R2, user.id, id, previousData);
					} else {
						await deleteCanvasDataFromR2(c.env.R2, user.id, id);
					}
				} catch (rollbackError) {
					logApiEvent('error', 'canvas.save_rollback_failed', {
						userId: user.id,
						canvasId: id,
						message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
					});
				}
			}

			if (error instanceof Error && error.message === 'Canvas version conflict during save.') {
				return c.json(
					{
						error: 'Canvas has changed since your last sync. Refresh before saving again.',
						currentVersion: canvas.version,
					},
					409,
				);
			}

			if (error instanceof CanvasPayloadTooLargeError) {
				return c.json({ error: getCanvasPayloadTooLargeMessage() }, 413);
			}

			logApiEvent('error', 'canvas.save_failed', {
				userId: user.id,
				canvasId: id,
				message: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
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

		await db.delete(canvases).where(eq(canvases.id, id));

		try {
			await deleteCanvasFromR2(c.env.R2, user.id, id);
		} catch (error) {
			logApiEvent('error', 'canvas.delete_storage_cleanup_failed', {
				userId: user.id,
				canvasId: id,
				message: error instanceof Error ? error.message : String(error),
			});
		}

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
