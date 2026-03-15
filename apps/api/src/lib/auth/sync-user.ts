import { and, eq, ne } from 'drizzle-orm';
import { users } from '../db/schema';
import type { Database } from '../db/client';
import type { AuthUser } from '../../types';

export async function syncAuthenticatedUser(db: Database, user: AuthUser): Promise<void> {
	// If a different user row already owns this email (e.g. after a Clerk instance migration),
	// remove it so the unique constraint doesn't block the upsert below.
	await db.delete(users).where(and(eq(users.email, user.email), ne(users.id, user.id)));

	await db
		.insert(users)
		.values({
			id: user.id,
			email: user.email,
			name: user.name,
			avatarUrl: user.avatarUrl,
		})
		.onConflictDoUpdate({
			target: users.id,
			set: {
				email: user.email,
				name: user.name,
				avatarUrl: user.avatarUrl,
			},
		});
}
