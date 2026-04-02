import { createClerkClient, verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { buildAuthUser } from '../lib/auth/build-auth-user';
import { syncAuthenticatedUser } from '../lib/auth/sync-user';
import { createDb } from '../lib/db/client';
import { users } from '../lib/db/schema';
import { getAuthorizedParties } from '../lib/local-dev-origins';
import { applySentryUserContext, logApiEvent } from '../lib/observability';
import type { AppEnv } from '../types';
import type { AuthUser } from '../types';

function getBearerToken(authHeader: string | undefined) {
	if (!authHeader?.startsWith('Bearer ')) {
		return null;
	}

	return authHeader.slice('Bearer '.length).trim() || null;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	const token = getBearerToken(c.req.header('Authorization'));

	if (!token) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	try {
		const authorizedParties = getAuthorizedParties(
			c.env.CLERK_AUTHORIZED_PARTIES,
			c.env.ENVIRONMENT,
		);
		const jwtKey = c.env.CLERK_JWT_KEY?.trim() || undefined;
		const session = await verifyToken(token, {
			secretKey: c.env.CLERK_SECRET_KEY,
			...(jwtKey ? { jwtKey } : {}),
			...(authorizedParties.length > 0 ? { authorizedParties } : {}),
		});

		if (!session.sub) {
			return c.json({ error: 'Unauthorized' }, 401);
		}

		const db = createDb(c.env.DB);

		// Check if the user already exists in D1. For returning users this avoids
		// a Clerk API call on every request, which is both faster and more resilient.
		const existingRows = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);

		let user: AuthUser;

		if (existingRows[0]) {
			// Returning user — use the locally stored profile.
			const row = existingRows[0];
			user = {
				id: row.id,
				email: row.email,
				name: row.name,
				avatarUrl: row.avatarUrl ?? undefined,
				preferences: row.preferences
					? (JSON.parse(row.preferences) as AuthUser['preferences'])
					: undefined,
			};
		} else {
			// New user — fetch their profile from Clerk and sync to D1.
			const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
			let clerkUser: Parameters<typeof buildAuthUser>[0];
			try {
				clerkUser = await clerk.users.getUser(session.sub);
			} catch (err) {
				logApiEvent('error', 'auth.clerk_user_fetch_failed', {
					sub: session.sub,
					message: err instanceof Error ? err.message : String(err),
				});
				return c.json({ error: 'Authentication failed' }, 500);
			}

			user = buildAuthUser(clerkUser);

			try {
				await syncAuthenticatedUser(db, user);
			} catch (err) {
				logApiEvent('error', 'auth.sync_user_failed', {
					userId: user.id,
					message: err instanceof Error ? err.message : String(err),
				});
				return c.json({ error: 'Authentication failed' }, 500);
			}
		}

		c.set('user', user);
		applySentryUserContext(user);

		await next();
	} catch (err) {
		// TokenVerificationError (from @clerk/backend) always has a `reason` property.
		if (err instanceof Error && 'reason' in err) {
			logApiEvent('warn', 'auth.token_verification_failed', {
				reason: (err as Record<string, unknown>).reason,
				message: err.message,
			});
			return c.json({ error: 'Invalid token' }, 401);
		}
		logApiEvent('error', 'auth.unexpected_error', {
			message: err instanceof Error ? err.message : String(err),
		});
		return c.json({ error: 'Authentication failed' }, 500);
	}
});
