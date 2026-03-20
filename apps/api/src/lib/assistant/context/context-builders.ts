/**
 * Selected context building for assistant context
 */

import type { AssistantCanvasElementSummary, AssistantSelectedContext, CanvasElement } from '@ai-canvas/shared/types';
import { summarizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import {
	SELECTION_CONTEXT_PRIORITY,
	SELECTION_SUMMARY_LIMIT,
	TEXT_EXCERPT_LIMIT,
} from './constants';
import {
	toObjectRecord,
	getOverlayType,
	getOverlayLikeType,
	parseGeneratedDiagramMetadata,
	getElementType,
	buildElementLabel,
	buildElementTextExcerpt,
	normalizeText,
	normalizeMarkdownOverlay,
	normalizeKanbanOverlay,
	normalizeWebEmbedOverlay,
	normalizePrototypeOverlay,
} from './element-parsers';
import { buildBounds, buildStyleHints } from './geometry';

/** Get context kind from element */
export function getContextKind(element: CanvasElement): AssistantSelectedContext['kind'] {
	const overlayType = getOverlayType(element);
	if (overlayType === 'markdown') return 'markdown';
	if (overlayType === 'kanban') return 'kanban';
	if (overlayType === 'prototype') return 'prototype';
	if (overlayType === 'web-embed') return 'web-embed';
	if (parseGeneratedDiagramMetadata(element)) return 'generated-diagram';
	return 'generic';
}

/** Get sort label for element comparison */
function getElementSortLabel(element: CanvasElement): string {
	return buildElementLabel(element) ?? buildElementTextExcerpt(element) ?? '';
}

/** Compare elements by priority and label */
export function compareByPriorityAndLabel(a: CanvasElement, b: CanvasElement): number {
	const priorityDiff =
		SELECTION_CONTEXT_PRIORITY[getContextKind(a)] - SELECTION_CONTEXT_PRIORITY[getContextKind(b)];
	if (priorityDiff !== 0) {
		return priorityDiff;
	}

	const labelA = getElementSortLabel(a);
	const labelB = getElementSortLabel(b);
	if (labelA !== labelB) {
		return labelA.localeCompare(labelB);
	}

	return String(a.id).localeCompare(String(b.id));
}

/** Build element summary */
export function buildElementSummary(
	element: CanvasElement,
	distanceFromSelection?: number,
): AssistantCanvasElementSummary {
	return {
		id: String(element.id),
		elementType: getElementType(element),
		overlayType: getOverlayLikeType(element),
		label: buildElementLabel(element),
		textExcerpt: buildElementTextExcerpt(element),
		bounds: buildBounds(element),
		distanceFromSelection,
	};
}

/** Build generic context payload for non-specialized elements */
export function buildGenericContextPayload(element: CanvasElement) {
	const customData = toObjectRecord(element.customData);
	const text = buildElementTextExcerpt(element);
	return {
		shapeType: getElementType(element),
		text,
		link:
			normalizeText(element.link, 2000) ??
			normalizeText(customData?.url, 2000) ??
			normalizeText(customData?.href, 2000),
		hasImageFile:
			typeof element.fileId === 'string' ||
			typeof customData?.fileId === 'string' ||
			getElementType(element) === 'image',
		customDataType: typeof customData?.type === 'string' ? customData.type : undefined,
		isConnector: getElementType(element) === 'arrow' || getElementType(element) === 'line',
		isFrame: getElementType(element) === 'frame',
	};
}

/** Build selected context for an element */
export function buildSelectedContext(element: CanvasElement): AssistantSelectedContext {
	const overlayType = getOverlayType(element);
	const kind = getContextKind(element);
	const base = {
		id: String(element.id),
		priority: SELECTION_CONTEXT_PRIORITY[kind],
		elementType: getElementType(element),
		overlayType,
		label: buildElementLabel(element),
		bounds: buildBounds(element),
		styleHints: buildStyleHints(element),
		textExcerpt: buildElementTextExcerpt(element),
	};

	if (kind === 'markdown') {
		return {
			...base,
			kind,
			markdown: normalizeMarkdownOverlay(toObjectRecord(element.customData)),
		};
	}

	if (kind === 'kanban') {
		const kanban = normalizeKanbanOverlay(toObjectRecord(element.customData));
		return {
			...base,
			kind,
			kanban,
			kanbanSummary: summarizeKanbanOverlay(kanban),
		};
	}

	if (kind === 'web-embed') {
		return {
			...base,
			kind,
			webEmbed: normalizeWebEmbedOverlay(toObjectRecord(element.customData)),
		};
	}

	if (kind === 'prototype') {
		const prototype = normalizePrototypeOverlay(toObjectRecord(element.customData));
		return {
			...base,
			kind,
			prototype: {
				title: prototype.title,
				template: prototype.template,
				activeFile: prototype.activeFile,
				filePaths: Object.keys(prototype.files).sort((left, right) => left.localeCompare(right)),
				dependencies: Object.keys(prototype.dependencies ?? {}).sort((left, right) =>
					left.localeCompare(right),
				),
			},
		};
	}

	if (kind === 'generated-diagram') {
		const diagram = parseGeneratedDiagramMetadata(element);
		if (diagram) {
			return {
				...base,
				label: base.label ?? diagram.title,
				textExcerpt: base.textExcerpt ?? diagram.code.slice(0, TEXT_EXCERPT_LIMIT),
				kind,
				diagram: {
					language: diagram.language,
					code: diagram.code,
				},
			};
		}
	}

	return {
		...base,
		kind: 'generic',
		generic: buildGenericContextPayload(element),
	};
}

/** Build selection summary for snapshot */
export function buildSelectionSummary(
	selectedElements: CanvasElement[],
): Array<{ id: string; elementType: string; overlayType: string | undefined; label: string | undefined }> {
	return selectedElements.slice(0, SELECTION_SUMMARY_LIMIT).map((element) => ({
		id: String(element.id),
		elementType: getElementType(element),
		overlayType: getOverlayLikeType(element),
		label: buildElementLabel(element),
	}));
}
