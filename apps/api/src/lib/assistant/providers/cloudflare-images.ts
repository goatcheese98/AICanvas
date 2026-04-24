import type { AppEnv } from '../../../types';
import type { GeneratedImageAsset } from '../media-types';

interface CloudflareImagePayload {
	image?: string;
}

function getCloudflareImageModel(bindings: AppEnv['Bindings']): string {
	return bindings.CLOUDFLARE_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-4b';
}

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

function normalizeError(error: unknown, style: 'image' | 'sketch'): Error {
	if (!(error instanceof Error)) {
		return new Error(
			style === 'sketch'
				? 'Sketch generation failed. Try again in a moment, or switch to SVG illustration.'
				: 'Image generation failed. Try again in a moment.',
		);
	}

	const message = error.message.trim();
	const errorCodeMatch = message.match(/\berror code:\s*([A-Za-z0-9_-]+)/i);
	const errorCode = errorCodeMatch?.[1];

	if (errorCode) {
		const label = style === 'sketch' ? 'Sketch generation' : 'Image generation';
		return new Error(
			`${label} is temporarily unavailable from the image provider (code ${errorCode}). Try again in a moment, or switch to SVG illustration.`,
		);
	}

	return error;
}

export async function generateCloudflareImageAsset(
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

	const serializedForm = new Response(form);
	const formBody = serializedForm.body ?? (await serializedForm.arrayBuffer());
	const contentType = serializedForm.headers.get('content-type') ?? 'multipart/form-data';

	const model = getCloudflareImageModel(bindings);
	let payload: CloudflareImagePayload;

	try {
		payload = (await bindings.AI.run(
			model as Parameters<Ai['run']>[0],
			{
				multipart: {
					body: formBody,
					contentType,
				},
			} as unknown as Parameters<Ai['run']>[1],
		)) as CloudflareImagePayload;
	} catch (error) {
		throw normalizeError(error, input.style);
	}

	if (!payload.image) {
		throw new Error('Cloudflare image generation returned no image payload');
	}

	const bytes = toArrayBuffer(
		decodeBase64(payload.image, 'Cloudflare image generation returned an invalid image payload'),
	);
	if (bytes.byteLength === 0) {
		throw new Error('Cloudflare image generation returned an empty image payload');
	}

	return {
		bytes,
		mimeType: 'image/png',
		provider: 'cloudflare',
		model,
		prompt: input.prompt,
	};
}
