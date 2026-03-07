import { describe, expect, it } from 'vitest';
import { buildAuthUser } from './build-auth-user';

describe('buildAuthUser', () => {
	it('maps a Clerk user into the local auth shape', () => {
		expect(
			buildAuthUser({
				id: 'user_123',
				firstName: 'Rohan',
				lastName: 'Jasani',
				imageUrl: 'https://example.com/avatar.png',
				emailAddresses: [{ emailAddress: 'rohan@example.com' }],
			}),
		).toEqual({
			id: 'user_123',
			email: 'rohan@example.com',
			name: 'Rohan Jasani',
			avatarUrl: 'https://example.com/avatar.png',
		});
	});

	it('provides stable fallbacks when Clerk fields are sparse', () => {
		expect(
			buildAuthUser({
				id: 'user_456',
				username: 'canvas-user',
				emailAddresses: [],
			}),
		).toEqual({
			id: 'user_456',
			email: 'user_456@clerk.local',
			name: 'canvas-user',
			avatarUrl: undefined,
		});
	});
});
