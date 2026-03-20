import type { AppEnv } from '../../../types';
import type { VectorizedAsset } from '../media-adapters';

interface VectorizationPayload {
	svg?: string;
	content?: string;
	model?: string;
	tool?: string;
}

function encodeBase64(bytes: ArrayBuffer): string {
	const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary);
}

async function ensureOk(response: Response): Promise<Response> {
	if (response.ok) {
		return response;
	}
	const body = await response.text().catch(() => null);
	throw new Error(body || `Vectorization tool request failed: ${response.status}`);
}

function normalizeSvgContent(svg: string): string {
	const normalized = svg.trim();
	if (normalized.length === 0) {
		throw new Error('Vectorization tool returned an empty SVG payload');
	}
	if (!/^<svg\b/i.test(normalized)) {
		throw new Error('Vectorization tool returned invalid SVG content');
	}
	return normalized;
}

export async function vectorizeWithHttpTool(
	bindings: AppEnv['Bindings'],
	input: {
		bytes: ArrayBuffer;
		mimeType: string;
		prompt?: string;
	},
): Promise<VectorizedAsset> {
	const url = bindings.VECTORIZE_ASSET_URL;
	if (!url) {
		throw new Error('VECTORIZE_ASSET_URL is not configured for vectorization');
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	if (bindings.VECTORIZE_ASSET_API_KEY) {
		headers.Authorization = `Bearer ${bindings.VECTORIZE_ASSET_API_KEY}`;
	}

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			imageBase64: encodeBase64(input.bytes),
			mimeType: input.mimeType,
			prompt: input.prompt,
			outputFormat: 'svg',
		}),
	});

	const okResponse = await ensureOk(response);
	const payload = (await okResponse.json()) as VectorizationPayload;
	const svg = payload.svg ?? payload.content;

	if (!svg) {
		throw new Error('Vectorization tool returned no SVG content');
	}

	return {
		content: normalizeSvgContent(svg),
		mimeType: 'image/svg+xml',
		provider: 'http-tool',
		tool: payload.tool ?? 'vectorize_asset',
		model: payload.model,
	};
}
