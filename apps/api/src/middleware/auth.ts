import { createMiddleware } from 'hono/factory';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { createDb } from '../lib/db/client';
import { applySentryUserContext } from '../lib/observability';
import { buildAuthUser } from '../lib/auth/build-auth-user';
import { syncAuthenticatedUser } from '../lib/auth/sync-user';
import type { AppEnv } from '../types';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
	const authHeader = c.req.header('Authorization');

	if (!authHeader?.startsWith('Bearer ')) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	const token = authHeader.slice(7);

	try {
		const session = await verifyToken(token, {
			secretKey: c.env.CLERK_SECRET_KEY,
		});
		const clerkUser = await clerk.users.getUser(session.sub);
		const user = buildAuthUser(clerkUser);
		const db = createDb(c.env.DB);

		await syncAuthenticatedUser(db, user);

		c.set('user', user);
		applySentryUserContext(user);

		await next();
	} catch {
		return c.json({ error: 'Invalid token' }, 401);
	}
});
