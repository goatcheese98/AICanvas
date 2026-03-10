/// <reference types="@cloudflare/workers-types" />

const ASSISTANT_ASSET_PREFIX = 'assistant-assets';

function assistantAssetKey(runId: string, artifactId: string, extension: string): string {
	return `${ASSISTANT_ASSET_PREFIX}/${runId}/${artifactId}.${extension}`;
}

function extensionForMimeType(mimeType: string): string {
	switch (mimeType) {
		case 'image/png':
			return 'png';
		case 'image/svg+xml':
			return 'svg';
		default:
			return 'bin';
	}
}

export async function saveAssistantAssetToR2(
	r2: R2Bucket,
	runId: string,
	artifactId: string,
	input: {
		body: ArrayBuffer | string;
		mimeType: string;
	},
): Promise<string> {
	const key = assistantAssetKey(runId, artifactId, extensionForMimeType(input.mimeType));
	await r2.put(key, input.body, {
		httpMetadata: {
			contentType: input.mimeType,
			cacheControl: 'private, max-age=31536000',
		},
	});
	return key;
}

export async function loadAssistantAssetFromR2(
	r2: R2Bucket,
	key: string,
): Promise<R2ObjectBody | null> {
	return r2.get(key);
}
