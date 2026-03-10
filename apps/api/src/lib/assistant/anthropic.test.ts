import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnthropicMessage } from './anthropic';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('anthropic adapter', () => {
	it('calls the Anthropic messages API and extracts text content', async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					model: 'claude-3-5-haiku-latest',
					content: [
						{
							type: 'text',
							text: 'Anthropic output',
						},
					],
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await createAnthropicMessage(
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
			{
				system: 'You are AI Canvas.',
				messages: [{ role: 'user', content: 'Say hello.' }],
			},
		);

		expect(result.text).toBe('Anthropic output');
		expect(result.model).toBe('claude-3-5-haiku-latest');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const init = (fetchMock.mock.calls.at(0) as unknown[] | undefined)?.at(1) as RequestInit | undefined;
		expect(JSON.parse(String(init?.body))).toMatchObject({
			system: 'You are AI Canvas.',
			messages: [{ role: 'user', content: 'Say hello.' }],
		});
	});
});
