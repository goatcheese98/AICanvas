/**
 * Canvas summary construction for assistant context
 */

import type { AssistantCanvasSummary, CanvasElement } from '@ai-canvas/shared/types';
import {
	CANVAS_ELEMENT_SUMMARY_LIMIT,
	CANVAS_HIGHLIGHT_LIMIT,
	EDITABLE_OVERLAY_TYPES,
} from './constants';
import { buildElementSummary, compareByPriorityAndLabel } from './context-builders';
import {
	buildElementLabel,
	buildElementTextExcerpt,
	getElementType,
	getOverlayLikeType,
} from './element-parsers';
import { toElementId } from './element-parsers';

/** Compare elements for canvas summary prioritization */
function compareCanvasSummaryCandidates(a: CanvasElement, b: CanvasElement): number {
	const overlayA = getOverlayLikeType(a);
	const overlayB = getOverlayLikeType(b);
	if (Boolean(overlayA) !== Boolean(overlayB)) {
		return overlayA ? -1 : 1;
	}

	const labelA = buildElementLabel(a);
	const labelB = buildElementLabel(b);
	if (Boolean(labelA) !== Boolean(labelB)) {
		return labelA ? -1 : 1;
	}

	const textA = buildElementTextExcerpt(a);
	const textB = buildElementTextExcerpt(b);
	if (Boolean(textA) !== Boolean(textB)) {
		return textA ? -1 : 1;
	}

	return compareByPriorityAndLabel(a, b);
}

/** Build element summaries for canvas overview */
export function buildCanvasElementSummaries(
	elements: CanvasElement[],
	selectedIdSet: Set<string>,
): import('@ai-canvas/shared/types').AssistantCanvasElementSummary[] | undefined {
	const summaries = elements
		.filter((element) => {
			const id = toElementId(element);
			return id ? !selectedIdSet.has(id) : false;
		})
		.sort(compareCanvasSummaryCandidates)
		.slice(0, CANVAS_ELEMENT_SUMMARY_LIMIT)
		.map((element) => buildElementSummary(element));

	return summaries.length > 0 ? summaries : undefined;
}

/** Increment count in a record map */
function incrementCount(map: Record<string, number>, key: string | undefined) {
	if (!key) {
		return;
	}

	map[key] = (map[key] ?? 0) + 1;
}

/** Build comprehensive canvas summary */
export function buildCanvasSummary(
	elements: CanvasElement[],
	selectedCount: number,
): AssistantCanvasSummary {
	const elementTypeCounts: Record<string, number> = {};
	const overlayTypeCounts: Record<string, number> = {};
	const highlights: string[] = [];
	let textBearingElementCount = 0;
	let editableOverlayCount = 0;

	for (const element of elements) {
		const elementType = getElementType(element);
		const overlayType = getOverlayLikeType(element);
		const label = buildElementLabel(element);
		const textExcerpt = buildElementTextExcerpt(element);

		incrementCount(elementTypeCounts, elementType);
		incrementCount(overlayTypeCounts, overlayType);

		if (overlayType && EDITABLE_OVERLAY_TYPES.has(overlayType)) {
			editableOverlayCount += 1;
		}

		if (label || textExcerpt) {
			textBearingElementCount += 1;
		}

		for (const candidate of [label, textExcerpt]) {
			if (!candidate || highlights.includes(candidate)) {
				continue;
			}
			highlights.push(candidate);
			if (highlights.length >= CANVAS_HIGHLIGHT_LIMIT) {
				break;
			}
		}
	}

	return {
		elementTypeCounts,
		overlayTypeCounts,
		textBearingElementCount,
		editableOverlayCount,
		selectedCount,
		hasKanban: (overlayTypeCounts.kanban ?? 0) > 0,
		hasMarkdown: (overlayTypeCounts.markdown ?? 0) > 0,
		hasPrototype: (overlayTypeCounts.prototype ?? 0) > 0,
		highlights,
	};
}
