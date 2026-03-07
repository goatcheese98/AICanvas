import { users } from '../db/schema';
import type { Database } from '../db/client';
import type { AuthUser } from '../../types';

export async function syncAuthenticatedUser(db: Database, user: AuthUser): Promise<void> {
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
