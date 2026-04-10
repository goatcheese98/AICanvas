import type { CSSProperties } from 'react';
import type rehypeKatex from 'rehype-katex';
import type rehypeRaw from 'rehype-raw';
import type remarkGfm from 'remark-gfm';
import type remarkMath from 'remark-math';

// ===== Types for Plugins =====
type RemarkPlugin = typeof remarkMath | typeof remarkGfm;
type RehypePlugin = typeof rehypeRaw | typeof rehypeKatex;

// ===== Styling Constants =====
export const RENDERER_SURFACE = 'border border-stone-200';
export const SURFACE_RADIUS = '0.7em';
export const INLINE_RADIUS = '0.42em';
export const BLOCK_SPACING = '0.95em';
export const COMPACT_SPACING = '0.55em';
export const CELL_PADDING = '0.7em 0.95em';
export const CHECKBOX_SIZE = '1.05em';

export const HEADING_STYLES = {
	h1: { fontSize: '2em', lineHeight: 1.1, gap: '0.5em', marginBottom: '0.5em' },
	h2: { fontSize: '1.6em', lineHeight: 1.18, marginTop: '1.2em', marginBottom: '0.55em' },
	h3: { fontSize: '1.35em', lineHeight: 1.24, marginTop: '1em', marginBottom: '0.45em' },
	h4: { fontSize: '1.15em', lineHeight: 1.3, marginTop: '0.95em', marginBottom: '0.4em' },
	h5: { fontSize: '1em', lineHeight: 1.38, marginTop: '0.9em', marginBottom: '0.35em' },
	h6: { fontSize: '0.92em', lineHeight: 1.45, marginTop: '0.9em', marginBottom: '0.35em' },
} as const satisfies Record<string, CSSProperties>;

// ===== Type Helpers =====
type HeadingLevel = keyof typeof HEADING_STYLES;

interface NodePosition {
	start?: { line?: number | null } | null;
}

// ===== Global Cache =====
export const failedImageSrcCache = new Set<string>();

// ===== Parsing Functions =====
export function getCheckboxLineIndex(node: { position?: NodePosition | null }): number {
	const lineNumber = node.position?.start?.line;
	if (typeof lineNumber !== 'number' || Number.isNaN(lineNumber)) return -1;
	return Math.max(0, lineNumber - 1);
}

export function normalizeDisplayMath(content: string): string {
	const lines = content.split('\n');
	const normalized: string[] = [];
	let insideBlock = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (!insideBlock) {
			if (trimmed.startsWith('$$') && trimmed !== '$$') {
				const withoutOpening = trimmed.slice(2).trim();
				if (withoutOpening.endsWith('$$')) {
					normalized.push(line);
					continue;
				}

				insideBlock = true;
				normalized.push('$$');
				if (withoutOpening.length > 0) {
					normalized.push(withoutOpening);
				}
				continue;
			}

			normalized.push(line);
			continue;
		}

		if (trimmed.endsWith('$$') && trimmed !== '$$') {
			const withoutClosing = trimmed.slice(0, -2).trim();
			if (withoutClosing.length > 0) {
				normalized.push(withoutClosing);
			}
			normalized.push('$$');
			insideBlock = false;
			continue;
		}

		normalized.push(line);
	}

	return normalized.join('\n');
}

// ===== Cache Management =====
export function markImageAsFailed(src: string): void {
	failedImageSrcCache.add(src);
}

export function hasImageFailed(src: string): boolean {
	return failedImageSrcCache.has(src);
}

// ===== useSyncExternalStore Helpers for Failed Image Cache =====
// Store callbacks per image src to handle multiple instances properly
const cacheSubscribers = new Map<string, Set<() => void>>();

const originalAdd = failedImageSrcCache.add.bind(failedImageSrcCache);
failedImageSrcCache.add = (value: string): typeof failedImageSrcCache => {
	const result = originalAdd(value);
	const subscribers = cacheSubscribers.get(value);
	if (subscribers) {
		for (const callback of subscribers) {
			callback();
		}
	}
	return result;
};

export function subscribeToFailedImageCache(src: string, callback: () => void): () => void {
	if (!cacheSubscribers.has(src)) {
		cacheSubscribers.set(src, new Set());
	}
	const subscribers = cacheSubscribers.get(src)!;
	subscribers.add(callback);

	return () => {
		subscribers.delete(callback);
		if (subscribers.size === 0) {
			cacheSubscribers.delete(src);
		}
	};
}

export function getFailedImageCacheSnapshot(src: string): boolean {
	return failedImageSrcCache.has(src);
}
