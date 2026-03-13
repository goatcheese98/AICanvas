import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { canvasRoutes } from './routes/canvas';
import { assistantRoutes } from './routes/assistant';
import { userRoutes } from './routes/user';
import { waitlistRoutes } from './routes/waitlist';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>()
	.use('*', logger())
	.use(
		'*',
		cors({
			origin: ['http://localhost:5173'],
			credentials: true,
		}),
	)
	.route('/api/canvas', canvasRoutes)
	.route('/api/assistant', assistantRoutes)
	.route('/api/user', userRoutes)
	.route('/api/waitlist', waitlistRoutes)
	.get('/api/health', (c) => c.json({ status: 'ok' }));

export type AppType = typeof app;
export default app;
