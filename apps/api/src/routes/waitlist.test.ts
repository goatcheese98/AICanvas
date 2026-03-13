import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitlistSubscriptions } from '../lib/db/schema';
import type { AppEnv } from '../types';

const { findFirstMock, valuesMock, insertMock, createDbMock } = vi.hoisted(() => {
	const findFirstMock = vi.fn();
	const valuesMock = vi.fn();
	const insertMock = vi.fn(() => ({
		values: valuesMock,
	}));
	const createDbMock = vi.fn(() => ({
		query: {
			waitlistSubscriptions: {
				findFirst: findFirstMock,
			},
		},
		insert: insertMock,
	}));

	return {
		findFirstMock,
		valuesMock,
		insertMock,
		createDbMock,
	};
});

vi.mock('../lib/db/client', () => ({
	createDb: createDbMock,
}));

import { waitlistRoutes } from './waitlist';

function createRequest(body: Record<string, string>) {
	return new Request('http://localhost/', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
}

describe('waitlistRoutes', () => {
	beforeEach(() => {
		findFirstMock.mockReset();
		valuesMock.mockReset();
		insertMock.mockClear();
		createDbMock.mockClear();
		vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
	});

	it('creates a new waitlist submission', async () => {
		findFirstMock.mockResolvedValue(undefined);
		valuesMock.mockResolvedValue(undefined);

		const response = await waitlistRoutes.fetch(
			createRequest({
				email: 'hello@roopstudio.com',
				source: 'landing-hero',
			}),
			{ DB: {} as D1Database } as AppEnv['Bindings'],
			{} as ExecutionContext,
		);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({
			status: 'created',
			message: "Thanks for joining. We'll be in touch soon.",
		});
		expect(insertMock).toHaveBeenCalledWith(waitlistSubscriptions);
		expect(valuesMock).toHaveBeenCalledWith({
			id: '00000000-0000-4000-8000-000000000001',
			email: 'hello@roopstudio.com',
			source: 'landing-hero',
		});
	});

	it('returns a duplicate response when the email already exists', async () => {
		findFirstMock.mockResolvedValue({ id: 'existing-1' });

		const response = await waitlistRoutes.fetch(
			createRequest({
				email: 'hello@roopstudio.com',
				source: 'landing-footer',
			}),
			{ DB: {} as D1Database } as AppEnv['Bindings'],
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 'duplicate',
			message: "You're already on the RoopStudio waitlist.",
		});
		expect(insertMock).not.toHaveBeenCalled();
	});
});
