import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../types';
import type { Database } from '../db/client';
import { syncAuthenticatedUser } from './sync-user';

function createMockDb() {
	const deleteWhere = vi.fn().mockResolvedValue(undefined);
	const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
	const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
	const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
	const insert = vi.fn().mockReturnValue({ values });

	return {
		db: { delete: deleteFn, insert } as unknown as Database,
		mocks: { deleteWhere, deleteFn, onConflictDoUpdate, values, insert },
	};
}

const user: AuthUser = {
	id: 'user_new',
	email: 'test@example.com',
	name: 'Test User',
	avatarUrl: undefined,
};

describe('syncAuthenticatedUser', () => {
	it('upserts the user into the database', async () => {
		const { db, mocks } = createMockDb();

		await syncAuthenticatedUser(db, user);

		expect(mocks.insert).toHaveBeenCalledOnce();
		expect(mocks.values).toHaveBeenCalledWith(
			expect.objectContaining({
				id: user.id,
				email: user.email,
				name: user.name,
			}),
		);
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				set: expect.objectContaining({ email: user.email }),
			}),
		);
	});

	it('deletes any stale row with the same email before upserting to prevent unique constraint violations', async () => {
		// Regression: switching Clerk instances produces a new user ID for an existing
		// email. Without the pre-delete, the upsert hits a unique constraint on `email`
		// and the request fails with "Authentication failed".
		const { db, mocks } = createMockDb();
		const callOrder: string[] = [];

		mocks.deleteWhere.mockImplementation(() => {
			callOrder.push('delete');
			return Promise.resolve(undefined);
		});
		mocks.onConflictDoUpdate.mockImplementation(() => {
			callOrder.push('upsert');
			return Promise.resolve(undefined);
		});

		await syncAuthenticatedUser(db, user);

		expect(callOrder).toEqual(['delete', 'upsert']);
	});

	it('always attempts the stale-row delete even when no conflict exists', async () => {
		const { db, mocks } = createMockDb();

		await syncAuthenticatedUser(db, user);

		expect(mocks.deleteFn).toHaveBeenCalledOnce();
		expect(mocks.deleteWhere).toHaveBeenCalledOnce();
	});
});
