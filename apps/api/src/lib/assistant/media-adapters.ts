import type { AppEnv } from '../../types';

export interface GeneratedImageAsset {
	bytes: ArrayBuffer;
	mimeType: string;
	provider: 'cloudflare' | 'openrouter';
	model: string;
	prompt: string;
	revisedPrompt?: string;
}

export interface VectorizedAsset {
	content: string;
	mimeType: 'image/svg+xml';
	provider: 'http-tool';
	tool: string;
	model?: string;
}

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeBase64(bytes: ArrayBuffer): string {
	const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary);
}

function getOpenRouterBaseUrl(bindings: AppEnv['Bindings']): string {
	return bindings.OPENROUTER_API_BASE_URL ?? 'https://openrouter.ai/api/v1';
}

function getCloudflareImageModel(bindings: AppEnv['Bindings']): string {
	return bindings.CLOUDFLARE_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-4b';
}

function ensureFetchOk(response: Response, fallback: string): Promise<Response> {
	if (response.ok) {
		return Promise.resolve(response);
	}

	return response
		.text()
		.then((body) => {
			throw new Error(body || fallback);
		})
		.catch((error) => {
			throw error instanceof Error ? error : new Error(fallback);
		});
}

async function generateCloudflareImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		prompt: string;
		style: 'image' | 'sketch';
	},
): Promise<GeneratedImageAsset> {
	if (!bindings.AI) {
		throw new Error('AI binding is not configured for Cloudflare image generation');
	}

	const form = new FormData();
	form.append('prompt', input.prompt);
	form.append('width', '1024');
	form.append('height', '1024');
	form.append('steps', input.style === 'sketch' ? '12' : '20');

	// Workers AI expects multipart payloads for this model.
	const serializedForm = new Response(form);
	const formBody = serializedForm.body ?? (await serializedForm.arrayBuffer());
	const contentType = serializedForm.headers.get('content-type') ?? 'multipart/form-data';

	const payload = (await bindings.AI.run(
		getCloudflareImageModel(bindings) as Parameters<Ai['run']>[0],
		{
			multipart: {
				body: formBody,
				contentType,
			},
		} as unknown as Parameters<Ai['run']>[1],
	)) as {
		image?: string;
	};

	if (!payload.image) {
		throw new Error('Cloudflare image generation returned no image payload');
	}

	return {
		bytes: toArrayBuffer(decodeBase64(payload.image)),
		mimeType: 'image/png',
		provider: 'cloudflare',
		model: getCloudflareImageModel(bindings),
		prompt: input.prompt,
	};
}

export async function generateImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		prompt: string;
		style: 'image' | 'sketch';
	},
): Promise<GeneratedImageAsset> {
	if (bindings.AI) {
		return generateCloudflareImageAsset(bindings, input);
	}

	if (!bindings.OPENROUTER_API_KEY) {
		throw new Error('AI binding or OPENROUTER_API_KEY must be configured for image generation');
	}

	const response = await fetch(`${getOpenRouterBaseUrl(bindings)}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${bindings.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'X-Title': 'AI Canvas',
		},
		body: JSON.stringify({
			model: bindings.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image-preview',
			modalities: ['image', 'text'],
			messages: [
				{
					role: 'user',
					content: input.prompt,
				},
			],
		}),
	});

	const okResponse = await ensureFetchOk(response, 'OpenRouter image generation failed');
		const payload = (await okResponse.json()) as {
			choices?: Array<{
				message?: {
					content?: string;
					images?: Array<{
						image_url?: {
							url?: string;
						} | string;
					}>;
				};
			}>;
		};
		const imageRef = payload.choices?.[0]?.message?.images?.[0]?.image_url;
		const imageUrl = typeof imageRef === 'string' ? imageRef : imageRef?.url;

	if (!imageUrl?.startsWith('data:')) {
		throw new Error('OpenRouter image generation returned no inline image payload');
	}

	const [header, encoded] = imageUrl.split(',', 2);
	if (!encoded) {
		throw new Error('OpenRouter image generation returned an invalid data URL');
	}
	const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] ?? 'image/png';
	const bytes = toArrayBuffer(decodeBase64(encoded));

	return {
		bytes,
		mimeType,
		provider: 'openrouter',
		model: bindings.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image-preview',
		prompt: input.prompt,
		revisedPrompt:
			typeof payload.choices?.[0]?.message?.content === 'string'
				? payload.choices[0].message.content
				: undefined,
	};
}

export async function vectorizeImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		bytes: ArrayBuffer;
		mimeType: string;
		prompt?: string;
	},
): Promise<VectorizedAsset> {
	if (!bindings.VECTORIZE_ASSET_URL) {
		throw new Error('VECTORIZE_ASSET_URL is not configured for vectorization');
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	if (bindings.VECTORIZE_ASSET_API_KEY) {
		headers.Authorization = `Bearer ${bindings.VECTORIZE_ASSET_API_KEY}`;
	}

	const response = await fetch(bindings.VECTORIZE_ASSET_URL, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			imageBase64: encodeBase64(input.bytes),
			mimeType: input.mimeType,
			prompt: input.prompt,
			outputFormat: 'svg',
		}),
	});

	const okResponse = await ensureFetchOk(response, 'Vectorization tool request failed');
	const payload = (await okResponse.json()) as {
		svg?: string;
		content?: string;
		model?: string;
		tool?: string;
	};
	const svg = payload.svg ?? payload.content;

	if (!svg) {
		throw new Error('Vectorization tool returned no SVG content');
	}

	return {
		content: svg,
		mimeType: 'image/svg+xml',
		provider: 'http-tool',
		tool: payload.tool ?? 'vectorize_asset',
		model: payload.model,
	};
}
