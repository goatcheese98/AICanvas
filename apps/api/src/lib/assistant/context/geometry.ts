/**
 * Geometry and spatial helpers for assistant context
 */

import type { AssistantCanvasBounds, CanvasElement } from '@ai-canvas/shared/types';
import type { AssistantCanvasStyleHints } from '@ai-canvas/shared/types';
import { toObjectRecord } from './element-parsers';

/** Build bounds from element position and dimensions */
export function buildBounds(element: CanvasElement): AssistantCanvasBounds | undefined {
	const x = typeof element.x === 'number' ? element.x : undefined;
	const y = typeof element.y === 'number' ? element.y : undefined;
	if (typeof x !== 'number' || typeof y !== 'number') {
		return undefined;
	}

	const width = typeof element.width === 'number' ? Math.abs(element.width) : 0;
	const height = typeof element.height === 'number' ? Math.abs(element.height) : 0;
	return { x, y, width, height };
}

/** Stringify roundness value for style hints */
function stringifyRoundness(value: unknown): string | undefined {
	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}

	const record = toObjectRecord(value);
	if (!record) {
		return undefined;
	}

	const type = typeof record.type === 'number' ? record.type : undefined;
	const radius = typeof record.value === 'number' ? record.value : undefined;
	if (typeof type !== 'number') {
		return undefined;
	}

	return radius != null ? `type:${type},value:${radius}` : `type:${type}`;
}

/** Build style hints from element properties */
export function buildStyleHints(element: CanvasElement): AssistantCanvasStyleHints | undefined {
	const hints: AssistantCanvasStyleHints = {};

	if (typeof element.backgroundColor === 'string' && element.backgroundColor.trim()) {
		hints.backgroundColor = element.backgroundColor;
	}
	if (typeof element.strokeColor === 'string' && element.strokeColor.trim()) {
		hints.strokeColor = element.strokeColor;
	}
	if (typeof element.fillStyle === 'string' && element.fillStyle.trim()) {
		hints.fillStyle = element.fillStyle;
	}
	if (typeof element.roughness === 'number') {
		hints.roughness = element.roughness;
	}
	const roundness = stringifyRoundness(element.roundness);
	if (roundness) {
		hints.roundness = roundness;
	}
	if (typeof element.opacity === 'number') {
		hints.opacity = element.opacity;
	}

	return Object.keys(hints).length > 0 ? hints : undefined;
}

/** Calculate bounds for a set of selected elements */
export function getSelectionBounds(elements: CanvasElement[]): AssistantCanvasBounds | undefined {
	const bounds = elements.map(buildBounds).filter(Boolean) as AssistantCanvasBounds[];
	if (bounds.length === 0) {
		return undefined;
	}

	const left = Math.min(...bounds.map((item) => item.x));
	const top = Math.min(...bounds.map((item) => item.y));
	const right = Math.max(...bounds.map((item) => item.x + item.width));
	const bottom = Math.max(...bounds.map((item) => item.y + item.height));
	return {
		x: left,
		y: top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	};
}
