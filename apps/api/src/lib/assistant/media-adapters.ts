import type { AppEnv } from '../../types';

export interface GeneratedImageAsset {
	bytes: ArrayBuffer;
	mimeType: string;
	provider: 'openrouter';
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

export async function generateImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		prompt: string;
		style: 'image' | 'sketch';
	},
): Promise<GeneratedImageAsset> {
	if (!bindings.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is not configured for image generation');
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
