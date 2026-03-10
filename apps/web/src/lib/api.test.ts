import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createAssistantThread,
	deleteAssistantThread,
	fetchAssistantThreads,
	getRequiredAuthHeaders,
} from './api';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('getRequiredAuthHeaders', () => {
	it('returns a bearer token header', async () => {
		const headers = await getRequiredAuthHeaders(vi.fn().mockResolvedValue('test-token'));

		expect(headers).toEqual({
			Authorization: 'Bearer test-token',
		});
	});

	it('throws when no token is available', async () => {
		await expect(getRequiredAuthHeaders(vi.fn().mockResolvedValue(null))).rejects.toThrow(
			'Sign in is required to access this resource.',
		);
	});
});

describe('assistant thread api helpers', () => {
	it('fetches assistant threads for a canvas', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify([
					{
						id: 'thread-1',
						canvasId: 'canvas-1',
						title: 'Roadmap',
						messages: [],
						createdAt: '2026-03-10T00:00:00.000Z',
						updatedAt: '2026-03-10T00:00:00.000Z',
					},
				]),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;

		const threads = await fetchAssistantThreads('canvas-1', { Authorization: 'Bearer test' });

		expect(threads[0]?.id).toBe('thread-1');
		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/assistant/threads?canvasId=canvas-1',
			expect.objectContaining({
				headers: { Authorization: 'Bearer test' },
			}),
		);
	});

	it('creates an assistant thread', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					id: 'thread-2',
					canvasId: 'canvas-1',
					title: 'New chat',
					messages: [],
					createdAt: '2026-03-10T00:00:00.000Z',
					updatedAt: '2026-03-10T00:00:00.000Z',
				}),
				{ status: 201, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;

		const thread = await createAssistantThread(
			{ canvasId: 'canvas-1', title: 'New chat' },
			{ Authorization: 'Bearer test' },
		);

		expect(thread.id).toBe('thread-2');
		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/assistant/threads',
			expect.objectContaining({
				method: 'POST',
			}),
		);
	});

	it('deletes an assistant thread', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		) as typeof fetch;

		await expect(
			deleteAssistantThread('thread-1', { Authorization: 'Bearer test' }),
		).resolves.toBeUndefined();
		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/assistant/threads/thread-1',
			expect.objectContaining({
				method: 'DELETE',
			}),
		);
	});
});
