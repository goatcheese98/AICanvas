/**
 * Element parsing utilities for assistant context
 */

import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
} from '@ai-canvas/shared/schemas';
import type { CanvasElement } from '@ai-canvas/shared/types';
import { OVERLAY_TYPES, TEXT_EXCERPT_LIMIT } from './constants';

/** Interface for generated diagram metadata */
export interface GeneratedDiagramMetadata {
	type: 'ai-generated-diagram';
	language: 'mermaid' | 'd2';
	code: string;
	title?: string;
}

/** Convert unknown value to object record if possible */
export function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

/** Extract element ID from canvas element */
export function toElementId(element: CanvasElement): string | null {
	const id = element.id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Normalize text value to a trimmed string with max length */
export function normalizeText(value: unknown, maxLength = 240): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = value.trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return undefined;
	}

	return normalized.slice(0, maxLength);
}

/** Get overlay type from element if it's a recognized overlay */
export function getOverlayType(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	return typeof customData?.type === 'string' && OVERLAY_TYPES.has(customData.type)
		? customData.type
		: undefined;
}

/** Get overlay-like type, including generated diagrams */
export function getOverlayLikeType(element: CanvasElement): string | undefined {
	return (
		getOverlayType(element) ??
		(parseGeneratedDiagramMetadata(element) ? 'generated-diagram' : undefined)
	);
}

/** Parse generated diagram metadata from element if present */
export function parseGeneratedDiagramMetadata(
	element: CanvasElement,
): GeneratedDiagramMetadata | null {
	const customData = toObjectRecord(element.customData);
	if (customData?.type !== 'ai-generated-diagram') {
		return null;
	}

	const language = customData.language;
	const code = customData.code;
	if (
		(language !== 'mermaid' && language !== 'd2') ||
		typeof code !== 'string' ||
		code.trim().length === 0
	) {
		return null;
	}

	return {
		type: 'ai-generated-diagram',
		language,
		code: code.trim(),
		title: normalizeText(customData.title, 240),
	};
}

/** Get the element type as a string */
export function getElementType(element: CanvasElement): string {
	return typeof element.type === 'string' ? element.type : 'unknown';
}

/** Build a label for the element from available text fields */
export function buildElementLabel(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	const textCandidates = [
		customData?.title,
		customData?.name,
		element.text,
		customData?.content,
		customData?.url,
	];

	for (const candidate of textCandidates) {
		const normalized = normalizeText(candidate, 120);
		if (normalized) {
			return normalized;
		}
	}

	return undefined;
}

/** Build a text excerpt for the element */
export function buildElementTextExcerpt(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	const label = buildElementLabel(element);
	const candidates = [
		element.text,
		customData?.content,
		customData?.description,
		customData?.body,
		customData?.url,
	];

	for (const candidate of candidates) {
		const normalized = normalizeText(candidate, TEXT_EXCERPT_LIMIT);
		if (normalized && normalized !== label) {
			return normalized;
		}
	}

	return label;
}

// Re-export normalize functions from shared schemas for convenience
export {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
};
