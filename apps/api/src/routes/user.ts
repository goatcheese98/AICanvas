import { userSchemas } from '@ai-canvas/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../lib/db/client';
import { users } from '../lib/db/schema';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

export const userRoutes = new Hono<AppEnv>()
	.use(requireAuth)

	// Get current user profile
	.get('/me', (c) => {
		const user = c.get('user');
		return c.json(user);
	})

	// Update preferences
	.put('/preferences', zValidator('json', userSchemas.preferences), async (c) => {
		const preferences = c.req.valid('json');
		const user = c.get('user');
		const db = createDb(c.env.DB);

		await db
			.update(users)
			.set({ preferences: JSON.stringify(preferences) })
			.where(eq(users.id, user.id));

		return c.json({ success: true, preferences });
	});
