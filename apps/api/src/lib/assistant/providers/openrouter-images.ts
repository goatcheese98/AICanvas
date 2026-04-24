import type { AppEnv } from '../../../types';
import type { GeneratedImageAsset } from '../media-types';

interface OpenRouterImageRef {
	image_url?:
		| {
				url?: string;
		  }
		| string;
	url?: string;
}

interface OpenRouterMessageContentPart {
	type?: string;
	text?: string;
	image_url?:
		| {
				url?: string;
		  }
		| string;
	url?: string;
}

type OpenRouterMessageContent = string | OpenRouterMessageContentPart[];

interface OpenRouterImageGenerationPayload {
	choices?: Array<{
		message?: {
			content?: OpenRouterMessageContent;
			images?: OpenRouterImageRef[];
		};
	}>;
}

function getOpenRouterBaseUrl(bindings: AppEnv['Bindings']): string {
	return bindings.OPENROUTER_API_BASE_URL ?? 'https://openrouter.ai/api/v1';
}

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getOpenRouterImageUrl(
	reference: OpenRouterImageRef | OpenRouterMessageContentPart,
): string | null {
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

function extractRevisedPrompt(content: OpenRouterMessageContent | undefined): string | undefined {
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

function parseInlineImage(payload: OpenRouterImageGenerationPayload): {
	imageUrl: string;
	revisedPrompt?: string;
} {
	const message = payload.choices?.[0]?.message;
	const imageUrl =
		message?.images
			?.map((image) => getOpenRouterImageUrl(image))
			.find((candidate): candidate is string => Boolean(candidate)) ??
		(Array.isArray(message?.content)
			? message.content
					.map((part) => getOpenRouterImageUrl(part))
					.find((candidate): candidate is string => Boolean(candidate))
			: null);

	if (!imageUrl?.startsWith('data:')) {
		throw new Error('OpenRouter image generation returned no inline image payload');
	}

	return {
		imageUrl,
		revisedPrompt: extractRevisedPrompt(message?.content),
	};
}

function parseImageDataUrl(imageUrl: string): { mimeType: string; bytes: ArrayBuffer } {
	const [header, encoded] = imageUrl.split(',', 2);
	if (!encoded) {
		throw new Error('OpenRouter image generation returned an invalid data URL');
	}

	const mimeType = header.match(/^data:([^;]+);base64$/)?.[1];
	if (!mimeType?.startsWith('image/')) {
		throw new Error('OpenRouter image generation returned an unsupported image MIME type');
	}

	let bytes: ArrayBuffer;
	try {
		bytes = toArrayBuffer(decodeBase64(encoded));
	} catch {
		throw new Error('OpenRouter image generation returned an invalid image payload');
	}

	if (bytes.byteLength === 0) {
		throw new Error('OpenRouter image generation returned an empty image payload');
	}

	return { mimeType, bytes };
}

async function ensureOk(response: Response): Promise<Response> {
	if (response.ok) {
		return response;
	}
	const body = await response.text().catch(() => null);
	throw new Error(body || `OpenRouter image generation failed: ${response.status}`);
}

function normalizeError(error: unknown, style: 'image' | 'sketch'): Error {
	if (!(error instanceof Error)) {
		return new Error(
			style === 'sketch'
				? 'Sketch generation failed. Try again in a moment, or switch to SVG illustration.'
				: 'Image generation failed. Try again in a moment.',
		);
	}

	const message = error.message.trim();
	const jsonCodeMatch = message.match(/"code"\s*:\s*"?([A-Za-z0-9_-]+)"?/i);
	const errorCode = jsonCodeMatch?.[1];

	if (errorCode) {
		const label = style === 'sketch' ? 'Sketch generation' : 'Image generation';
		return new Error(
			`${label} is temporarily unavailable from the image API (code ${errorCode}). Try again in a moment, or switch to SVG illustration.`,
		);
	}

	return error;
}

export async function generateOpenRouterImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		prompt: string;
		style: 'image' | 'sketch';
	},
): Promise<GeneratedImageAsset> {
	const apiKey = bindings.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error('OPENROUTER_API_KEY is not configured for image generation');
	}

	const model = bindings.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image-preview';
	const baseUrl = getOpenRouterBaseUrl(bindings);

	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'X-Title': 'AI Canvas',
		},
		body: JSON.stringify({
			model,
			modalities: ['image', 'text'],
			messages: [{ role: 'user', content: input.prompt }],
		}),
	});

	const okResponse = await ensureOk(response).catch((error) => {
		throw normalizeError(error, input.style);
	});

	const payload = (await okResponse.json()) as OpenRouterImageGenerationPayload;
	const { imageUrl, revisedPrompt } = parseInlineImage(payload);
	const { mimeType, bytes } = parseImageDataUrl(imageUrl);

	return {
		bytes,
		mimeType,
		provider: 'openrouter',
		model,
		prompt: input.prompt,
		revisedPrompt,
	};
}
