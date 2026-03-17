import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateImageAsset, vectorizeImageAsset } from './media-adapters';

const originalFetch = globalThis.fetch;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64(value: string): string {
	const binary = Array.from(textEncoder.encode(value), (byte) => String.fromCharCode(byte)).join(
		'',
	);
	return btoa(binary);
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('assistant media adapters', () => {
	it('calls the Cloudflare AI binding and decodes the returned bytes', async () => {
		const run = vi.fn(async () => ({
			image: encodeBase64('png-bytes'),
		}));

		const result = await generateImageAsset(
			{
				AI: { run } as unknown as Ai,
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ENVIRONMENT: 'test',
			},
			{
				prompt: 'Create a product poster',
				style: 'image',
			},
		);

		expect(textDecoder.decode(result.bytes)).toBe('png-bytes');
		expect(result.provider).toBe('cloudflare');
		expect(result.model).toBe('@cf/black-forest-labs/flux-2-klein-4b');
		expect(run).toHaveBeenCalledOnce();
	});

	it('falls back to the OpenRouter image API when no AI binding is configured', async () => {
		globalThis.fetch = vi.fn(
			async () =>
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

	it('extracts OpenRouter revised prompts from structured content parts', async () => {
		globalThis.fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: [
										{ type: 'text', text: 'revised prompt' },
										{ type: 'text', text: 'with extra detail' },
									],
									images: [
										{
											image_url: `data:image/webp;base64,${encodeBase64('webp-bytes')}`,
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

		expect(textDecoder.decode(result.bytes)).toBe('webp-bytes');
		expect(result.mimeType).toBe('image/webp');
		expect(result.revisedPrompt).toBe('revised prompt\nwith extra detail');
	});

	it('rejects OpenRouter responses without a usable inline image payload', async () => {
		globalThis.fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: 'revised prompt',
									images: [],
								},
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		) as typeof fetch;

		await expect(
			generateImageAsset(
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
			),
		).rejects.toThrow('OpenRouter image generation returned no inline image payload');
	});

	it('rejects Cloudflare responses with invalid image bytes', async () => {
		const run = vi.fn(async () => ({
			image: '!not-base64!',
		}));

		await expect(
			generateImageAsset(
				{
					AI: { run } as unknown as Ai,
					DB: {} as D1Database,
					R2: {} as R2Bucket,
					CLERK_SECRET_KEY: 'clerk',
					ENVIRONMENT: 'test',
				},
				{
					prompt: 'Create a product poster',
					style: 'image',
				},
			),
		).rejects.toThrow('Cloudflare image generation returned an invalid image payload');
	});

	it('normalizes opaque Cloudflare sketch errors into a user-facing message', async () => {
		const run = vi.fn(async () => {
			throw new Error('error code: 1031');
		});

		await expect(
			generateImageAsset(
				{
					AI: { run } as unknown as Ai,
					DB: {} as D1Database,
					R2: {} as R2Bucket,
					CLERK_SECRET_KEY: 'clerk',
					ENVIRONMENT: 'test',
				},
				{
					prompt: 'Create a sketch of a cat',
					style: 'sketch',
				},
			),
		).rejects.toThrow(
			'Sketch generation is temporarily unavailable from the image provider (code 1031). Try again in a moment, or switch to SVG illustration.',
		);
	});

	it('normalizes opaque OpenRouter image errors into a user-facing message', async () => {
		globalThis.fetch = vi.fn(
			async () => new Response('{"code":"upstream_timeout"}', { status: 502 }),
		) as typeof fetch;

		await expect(
			generateImageAsset(
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
			),
		).rejects.toThrow(
			'Image generation is temporarily unavailable from the image API (code upstream_timeout). Try again in a moment, or switch to SVG illustration.',
		);
	});

	it('calls the vectorization tool endpoint and returns svg content', async () => {
		globalThis.fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						svg: '  <svg viewBox="0 0 10 10"></svg>\n',
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

		expect(result.content).toBe('<svg viewBox="0 0 10 10"></svg>');
		expect(result.tool).toBe('vectorizer');
		expect(result.provider).toBe('http-tool');
	});

	it('rejects vectorization responses with blank svg payloads', async () => {
		globalThis.fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						svg: '   \n\t  ',
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		) as typeof fetch;

		await expect(
			vectorizeImageAsset(
				{
					DB: {} as D1Database,
					R2: {} as R2Bucket,
					CLERK_SECRET_KEY: 'clerk',
					OPENROUTER_API_KEY: 'openrouter',
					VECTORIZE_ASSET_URL: 'https://vectorize.example.com/run',
					ENVIRONMENT: 'test',
				},
				{
					bytes: textEncoder.encode('png-bytes').buffer,
					mimeType: 'image/png',
				},
			),
		).rejects.toThrow('Vectorization tool returned an empty SVG payload');
	});

	it('rejects vectorization responses with non-svg content', async () => {
		globalThis.fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: '{"not":"svg"}',
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		) as typeof fetch;

		await expect(
			vectorizeImageAsset(
				{
					DB: {} as D1Database,
					R2: {} as R2Bucket,
					CLERK_SECRET_KEY: 'clerk',
					OPENROUTER_API_KEY: 'openrouter',
					VECTORIZE_ASSET_URL: 'https://vectorize.example.com/run',
					ENVIRONMENT: 'test',
				},
				{
					bytes: textEncoder.encode('png-bytes').buffer,
					mimeType: 'image/png',
				},
			),
		).rejects.toThrow('Vectorization tool returned invalid SVG content');
	});
});
