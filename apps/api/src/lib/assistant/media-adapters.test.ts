import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateImageAsset, vectorizeImageAsset } from './media-adapters';

const originalFetch = globalThis.fetch;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64(value: string): string {
	const binary = Array.from(textEncoder.encode(value), (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary);
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('assistant media adapters', () => {
	it('calls the OpenRouter image API and decodes the returned bytes', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: 'revised prompt',
								images: [
									{
										image_url: {
											url: `data:image/png;base64,${encodeBase64('png-bytes')}`,
										},
									},
								],
							},
						},
					],
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;

		const result = await generateImageAsset(
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				OPENROUTER_API_KEY: 'openrouter',
				ENVIRONMENT: 'test',
			},
			{
				prompt: 'Create a product poster',
				style: 'image',
			},
		);

		expect(textDecoder.decode(result.bytes)).toBe('png-bytes');
		expect(result.provider).toBe('openrouter');
		expect(result.revisedPrompt).toBe('revised prompt');
	});

	it('calls the vectorization tool endpoint and returns svg content', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					svg: '<svg viewBox="0 0 10 10"></svg>',
					tool: 'vectorizer',
					model: 'svg-tool-v1',
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;

		const result = await vectorizeImageAsset(
			{
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				OPENROUTER_API_KEY: 'openrouter',
				VECTORIZE_ASSET_URL: 'https://vectorize.example.com/run',
				VECTORIZE_ASSET_API_KEY: 'secret',
				ENVIRONMENT: 'test',
			},
			{
				bytes: textEncoder.encode('png-bytes').buffer,
				mimeType: 'image/png',
				prompt: 'Vectorize this asset',
			},
		);

		expect(result.content).toContain('<svg');
		expect(result.tool).toBe('vectorizer');
		expect(result.provider).toBe('http-tool');
	});
});
