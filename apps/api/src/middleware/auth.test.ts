import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { User } from '@clerk/backend';
import { requireAuth } from './auth';

const {
	verifyTokenMock,
	getUserMock,
	syncAuthenticatedUserMock,
	applySentryUserContextMock,
} = vi.hoisted(() => ({
	verifyTokenMock: vi.fn(),
	getUserMock: vi.fn(),
	syncAuthenticatedUserMock: vi.fn(),
	applySentryUserContextMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
	createClerkClient: () => ({
		users: {
			getUser: getUserMock,
		},
	}),
	verifyToken: verifyTokenMock,
}));

const { dbQueryMock } = vi.hoisted(() => ({
	dbQueryMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/db/client', () => ({
	createDb: () => ({
		select: () => ({
			from: () => ({
				where: () => ({
					limit: dbQueryMock,
				}),
			}),
		}),
	}),
}));

vi.mock('../lib/auth/sync-user', () => ({
	syncAuthenticatedUser: syncAuthenticatedUserMock,
}));

vi.mock('../lib/observability', () => ({
	applySentryUserContext: applySentryUserContextMock,
	logApiEvent: vi.fn(),
	applySentryRequestContext: vi.fn(),
}));

const clerkUser = {
	id: 'user_123',
	firstName: 'Rohan',
	lastName: 'Jasani',
	imageUrl: 'https://example.com/avatar.png',
	emailAddresses: [{ id: 'email_123', emailAddress: 'rohan@example.com' }],
	primaryEmailAddressId: 'email_123',
} as unknown as User;

function createTestApp() {
	return new Hono()
		.use('*', requireAuth)
		.get('/protected', (c) => c.json({ user: c.get('user') }));
}

describe('requireAuth', () => {
	beforeEach(() => {
		verifyTokenMock.mockReset();
		getUserMock.mockReset();
		syncAuthenticatedUserMock.mockReset();
		applySentryUserContextMock.mockReset();
		dbQueryMock.mockReset();
		dbQueryMock.mockResolvedValue([]);
	});

	it('returns unauthorized when the authorization header is missing', async () => {
		const app = createTestApp();

		const response = await app.request('http://localhost/protected', undefined, {
			DB: {} as D1Database,
			R2: {} as R2Bucket,
			CLERK_SECRET_KEY: 'sk_test_123',
			ENVIRONMENT: 'test',
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
	});

	it('returns invalid token when Clerk rejects the bearer token with a TokenVerificationError', async () => {
		const tokenError = Object.assign(new Error('Token signature is invalid.'), {
			reason: 'token-invalid-signature',
		});
		verifyTokenMock.mockRejectedValueOnce(tokenError);
		const app = createTestApp();

		const response = await app.request(
			'http://localhost/protected',
			{
				headers: {
					Authorization: 'Bearer bad-token',
				},
			},
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'sk_test_123',
				CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
				ENVIRONMENT: 'test',
			},
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid token' });
	});

	it('returns 500 when a non-token error occurs inside auth (e.g. DB failure)', async () => {
		verifyTokenMock.mockResolvedValueOnce({ sub: 'user_123' });
		getUserMock.mockRejectedValueOnce(new Error('Clerk API unavailable'));
		const app = createTestApp();

		const response = await app.request(
			'http://localhost/protected',
			{
				headers: {
					Authorization: 'Bearer good-token',
				},
			},
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'sk_test_123',
				ENVIRONMENT: 'test',
			},
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: 'Authentication failed' });
	});

	it('loads the Clerk user when the token is valid', async () => {
		verifyTokenMock.mockResolvedValueOnce({ sub: 'user_123' });
		getUserMock.mockResolvedValueOnce(clerkUser);
		const app = createTestApp();

		const response = await app.request(
			'http://localhost/protected',
			{
				headers: {
					Authorization: 'Bearer good-token',
				},
			},
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'sk_test_123',
				CLERK_PUBLISHABLE_KEY: 'pk_test_123',
				CORS_ALLOWED_ORIGINS: 'http://localhost:5173,https://roopstudio.com',
				ENVIRONMENT: 'test',
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			user: {
				id: 'user_123',
				email: 'rohan@example.com',
				name: 'Rohan Jasani',
				avatarUrl: 'https://example.com/avatar.png',
			},
		});
		expect(verifyTokenMock).toHaveBeenCalledWith(
			'good-token',
			expect.objectContaining({
				secretKey: 'sk_test_123',
			}),
		);
		expect(syncAuthenticatedUserMock).toHaveBeenCalledOnce();
		expect(applySentryUserContextMock).toHaveBeenCalledOnce();
	});

	it('uses locally stored profile for returning users without calling Clerk API', async () => {
		verifyTokenMock.mockResolvedValueOnce({ sub: 'user_123' });
		dbQueryMock.mockResolvedValueOnce([
			{
				id: 'user_123',
				email: 'rohan@example.com',
				name: 'Rohan Jasani',
				avatarUrl: 'https://example.com/avatar.png',
			},
		]);
		const app = createTestApp();

		const response = await app.request(
			'http://localhost/protected',
			{
				headers: {
					Authorization: 'Bearer good-token',
				},
			},
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'sk_test_123',
				ENVIRONMENT: 'test',
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			user: {
				id: 'user_123',
				email: 'rohan@example.com',
				name: 'Rohan Jasani',
				avatarUrl: 'https://example.com/avatar.png',
			},
		});
		expect(getUserMock).not.toHaveBeenCalled();
		expect(syncAuthenticatedUserMock).not.toHaveBeenCalled();
	});

	it('passes authorized parties only when explicitly configured', async () => {
		verifyTokenMock.mockResolvedValueOnce({ sub: 'user_123' });
		getUserMock.mockResolvedValueOnce(clerkUser);
		const app = createTestApp();

		await app.request(
			'http://localhost/protected',
			{
				headers: {
					Authorization: 'Bearer good-token',
				},
			},
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'sk_test_123',
				CLERK_AUTHORIZED_PARTIES: 'http://localhost:5173,https://roopstudio.com',
				ENVIRONMENT: 'production',
			},
		);

		expect(verifyTokenMock).toHaveBeenLastCalledWith(
			'good-token',
			expect.objectContaining({
				authorizedParties: ['http://localhost:5173', 'https://roopstudio.com'],
			}),
		);
	});
});
