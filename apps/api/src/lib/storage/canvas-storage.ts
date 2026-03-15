/// <reference types="@cloudflare/workers-types" />

import type { CanvasSavePayload } from '@ai-canvas/shared/types';
import { logApiEvent } from '../observability';

const CANVAS_PREFIX = 'canvases';

function canvasKey(userId: string, canvasId: string): string {
	return `${CANVAS_PREFIX}/${userId}/${canvasId}/canvas.json`;
}

function thumbnailKey(userId: string, canvasId: string): string {
	return `${CANVAS_PREFIX}/${userId}/${canvasId}/thumbnail.png`;
}

export async function saveCanvasToR2(
	r2: R2Bucket,
	userId: string,
	canvasId: string,
	payload: CanvasSavePayload,
): Promise<string> {
	const key = canvasKey(userId, canvasId);
	const body = JSON.stringify(payload);

	try {
		await r2.put(key, body, {
			httpMetadata: { contentType: 'application/json' },
		});
	} catch (err) {
		logApiEvent('error', 'r2.canvas_put_failed', {
			userId,
			canvasId,
			key,
			message: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}

	return key;
}

export async function loadCanvasFromR2(
	r2: R2Bucket,
	userId: string,
	canvasId: string,
): Promise<CanvasSavePayload | null> {
	const key = canvasKey(userId, canvasId);

	try {
		const object = await r2.get(key);
		if (!object) return null;
		return object.json<CanvasSavePayload>();
	} catch (err) {
		logApiEvent('error', 'r2.canvas_get_failed', {
			userId,
			canvasId,
			key,
			message: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

export async function saveThumbnailToR2(
	r2: R2Bucket,
	userId: string,
	canvasId: string,
	data: ArrayBuffer,
): Promise<string> {
	const key = thumbnailKey(userId, canvasId);

	try {
		await r2.put(key, data, {
			httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
		});
	} catch (err) {
		logApiEvent('error', 'r2.thumbnail_put_failed', {
			userId,
			canvasId,
			key,
			message: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}

	return key;
}

export async function loadThumbnailFromR2(
	r2: R2Bucket,
	userId: string,
	canvasId: string,
): Promise<R2ObjectBody | null> {
	const key = thumbnailKey(userId, canvasId);
	return r2.get(key);
}

export async function deleteCanvasFromR2(
	r2: R2Bucket,
	userId: string,
	canvasId: string,
): Promise<void> {
	const keys = [canvasKey(userId, canvasId), thumbnailKey(userId, canvasId)];

	try {
		await Promise.all(keys.map((key) => r2.delete(key)));
	} catch (err) {
		logApiEvent('error', 'r2.canvas_delete_failed', {
			userId,
			canvasId,
			message: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}
