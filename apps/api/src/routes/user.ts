import { userSchemas } from '@ai-canvas/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
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
		const _preferences = c.req.valid('json');
		const _user = c.get('user');

		// TODO: Store preferences in D1 or user metadata
		return c.json({ success: true });
	});
