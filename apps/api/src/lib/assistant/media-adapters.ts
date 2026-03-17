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

interface OpenRouterImageRef {
	image_url?: {
		url?: string;
	} | string;
	url?: string;
}

interface OpenRouterMessageContentPart {
	type?: string;
	text?: string;
	image_url?: {
		url?: string;
	} | string;
	url?: string;
}

interface OpenRouterImageGenerationPayload {
	choices?: Array<{
		message?: {
			content?: OpenRouterMessageContent;
			images?: OpenRouterImageRef[];
		};
	}>;
}

type OpenRouterMessageContent = string | OpenRouterMessageContentPart[];

function decodeBase64(value: string, fallback: string): Uint8Array {
	try {
		const binary = atob(value);
		return Uint8Array.from(binary, (char) => char.charCodeAt(0));
	} catch {
		throw new Error(fallback);
	}
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

function ensureNonEmptyBytes(bytes: Uint8Array, fallback: string): Uint8Array {
	if (bytes.byteLength === 0) {
		throw new Error(fallback);
	}

	return bytes;
}

function decodeGeneratedImageBytes(
	encoded: string,
	options: {
		invalidPayloadMessage: string;
		emptyPayloadMessage: string;
	},
): ArrayBuffer {
	return toArrayBuffer(
		ensureNonEmptyBytes(
			decodeBase64(encoded, options.invalidPayloadMessage),
			options.emptyPayloadMessage,
		),
	);
}

function getOpenRouterImageUrl(reference: OpenRouterImageRef | OpenRouterMessageContentPart): string | null {
	if (typeof reference.image_url === 'string') {
		return reference.image_url;
	}

	if (typeof reference.image_url?.url === 'string') {
		return reference.image_url.url;
	}

	if (typeof reference.url === 'string') {
		return reference.url;
	}

	return null;
}

function extractOpenRouterRevisedPrompt(
	content: OpenRouterMessageContent | undefined,
): string | undefined {
	if (typeof content === 'string') {
		const trimmed = content.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	if (!Array.isArray(content)) {
		return undefined;
	}

	const text = content
		.map((part) => (typeof part.text === 'string' ? part.text.trim() : ''))
		.filter((part) => part.length > 0)
		.join('\n')
		.trim();

	return text.length > 0 ? text : undefined;
}

function parseOpenRouterInlineImage(payload: OpenRouterImageGenerationPayload): {
	imageUrl: string;
	revisedPrompt?: string;
} {
	const message = payload.choices?.[0]?.message;
	const imageUrl =
		message?.images
			?.map((image) => getOpenRouterImageUrl(image))
			.find((candidate): candidate is string => Boolean(candidate))
		?? (Array.isArray(message?.content)
			? message.content
					.map((part) => getOpenRouterImageUrl(part))
					.find((candidate): candidate is string => Boolean(candidate))
			: null);

	if (!imageUrl?.startsWith('data:')) {
		throw new Error('OpenRouter image generation returned no inline image payload');
	}

	return {
		imageUrl,
		revisedPrompt: extractOpenRouterRevisedPrompt(message?.content),
	};
}

function parseInlineImageDataUrl(
	imageUrl: string,
	fallbackPrefix: string,
): { mimeType: string; bytes: ArrayBuffer } {
	const [header, encoded] = imageUrl.split(',', 2);
	if (!encoded) {
		throw new Error(`${fallbackPrefix} returned an invalid data URL`);
	}

	const mimeType = header.match(/^data:([^;]+);base64$/)?.[1];
	if (!mimeType?.startsWith('image/')) {
		throw new Error(`${fallbackPrefix} returned an unsupported image MIME type`);
	}

	return {
		mimeType,
		bytes: decodeGeneratedImageBytes(encoded, {
			invalidPayloadMessage: `${fallbackPrefix} returned an invalid image payload`,
			emptyPayloadMessage: `${fallbackPrefix} returned an empty image payload`,
		}),
	};
}

function normalizeSvgContent(svg: string, fallbackPrefix: string): string {
	const normalized = svg.trim();
	if (normalized.length === 0) {
		throw new Error(`${fallbackPrefix} returned an empty SVG payload`);
	}

	if (!/^<svg\b/i.test(normalized)) {
		throw new Error(`${fallbackPrefix} returned invalid SVG content`);
	}

	return normalized;
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

function extractProviderErrorCode(message: string): string | null {
	const directMatch = message.match(/\berror code:\s*([A-Za-z0-9_-]+)/i);
	if (directMatch?.[1]) {
		return directMatch[1];
	}

	const jsonCodeMatch = message.match(/"code"\s*:\s*"?([A-Za-z0-9_-]+)"?/i);
	return jsonCodeMatch?.[1] ?? null;
}

function normalizeImageGenerationError(
	error: unknown,
	options: {
		provider: 'cloudflare' | 'openrouter';
		style: 'image' | 'sketch';
	},
): Error {
	if (!(error instanceof Error)) {
		return new Error(
			options.style === 'sketch'
				? 'Sketch generation failed. Try again in a moment, or switch to SVG illustration.'
				: 'Image generation failed. Try again in a moment.',
		);
	}

	const message = error.message.trim();
	const providerLabel = options.provider === 'cloudflare' ? 'image provider' : 'image API';
	const generatedAssetLabel = options.style === 'sketch' ? 'Sketch generation' : 'Image generation';
	const errorCode = extractProviderErrorCode(message);
	if (errorCode) {
		return new Error(
			`${generatedAssetLabel} is temporarily unavailable from the ${providerLabel} (code ${errorCode}). Try again in a moment, or switch to SVG illustration.`,
		);
	}

	return error;
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

	let payload: {
		image?: string;
	};
	try {
		payload = (await bindings.AI.run(
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
	} catch (error) {
		throw normalizeImageGenerationError(error, {
			provider: 'cloudflare',
			style: input.style,
		});
	}

	if (!payload.image) {
		throw new Error('Cloudflare image generation returned no image payload');
	}

	return {
		bytes: decodeGeneratedImageBytes(payload.image, {
			invalidPayloadMessage: 'Cloudflare image generation returned an invalid image payload',
			emptyPayloadMessage: 'Cloudflare image generation returned an empty image payload',
		}),
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

	const okResponse = await ensureFetchOk(response, 'OpenRouter image generation failed').catch(
		(error) => {
			throw normalizeImageGenerationError(error, {
				provider: 'openrouter',
				style: input.style,
			});
		},
	);
	const payload = (await okResponse.json()) as OpenRouterImageGenerationPayload;
	const { imageUrl, revisedPrompt } = parseOpenRouterInlineImage(payload);
	const { mimeType, bytes } = parseInlineImageDataUrl(
		imageUrl,
		'OpenRouter image generation',
	);

	return {
		bytes,
		mimeType,
		provider: 'openrouter',
		model: bindings.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image-preview',
		prompt: input.prompt,
		revisedPrompt,
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
		content: normalizeSvgContent(svg, 'Vectorization tool'),
		mimeType: 'image/svg+xml',
		provider: 'http-tool',
		tool: payload.tool ?? 'vectorize_asset',
		model: payload.model,
	};
}
