import type { AssistantContextMode, CanvasElement } from '@ai-canvas/shared/types';

const SELECTION_KIND_PRIORITY: Record<string, number> = {
	markdown: 1,
	kanban: 2,
	prototype: 3,
	'web-embed': 4,
	'generated-diagram': 5,
	generic: 6,
};

const SELECTION_DEPENDENT_PROMPT_PATTERN =
	/\b(this|these|it|them|selected|selection|current|here|above|below|that note|that board|that card)\b/i;
const SELECTION_TRANSFORM_PROMPT_PATTERN =
	/\b(change|convert|edit|expand|fix|improve|make|organize|refine|rename|rewrite|shorten|summarize|transform|turn|update)\b/i;

export interface SelectionIndicator {
	count: number;
	label: string;
	detail: string;
}

function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function getSelectionKind(element: CanvasElement): string {
	const customData = toObjectRecord(element.customData);
	const overlayType = typeof customData?.type === 'string' ? customData.type : undefined;
	if (overlayType === 'markdown') return 'markdown';
	if (overlayType === 'kanban') return 'kanban';
	if (overlayType === 'prototype') return 'prototype';
	if (overlayType === 'web-embed') return 'web-embed';
	if (customData?.type === 'ai-generated-diagram') return 'generated-diagram';
	return 'generic';
}

function getSelectionLabel(kind: string, count: number): string {
	if (kind === 'markdown') return count === 1 ? 'markdown note' : 'markdown notes';
	if (kind === 'kanban') return count === 1 ? 'kanban board' : 'kanban boards';
	if (kind === 'prototype') return count === 1 ? 'prototype' : 'prototypes';
	if (kind === 'web-embed') return count === 1 ? 'web embed' : 'web embeds';
	if (kind === 'generated-diagram') return count === 1 ? 'generated diagram' : 'generated diagrams';
	return count === 1 ? 'item' : 'items';
}

export function getSelectedElementIdsFromMap(
	selectedElementIds: Record<string, boolean>,
): string[] {
	return Object.entries(selectedElementIds)
		.filter(([, isSelected]) => isSelected)
		.map(([id]) => id);
}

export function buildSelectionIndicator(
	elements: readonly CanvasElement[],
	selectedElementIds: Record<string, boolean>,
): SelectionIndicator | null {
	const selectedIds = new Set(getSelectedElementIdsFromMap(selectedElementIds));
	if (selectedIds.size === 0) {
		return null;
	}

	const selectedElements = elements.filter((element) => {
		const id = typeof element.id === 'string' ? element.id : String(element.id ?? '');
		return id.length > 0 && selectedIds.has(id);
	});
	if (selectedElements.length === 0) {
		return null;
	}

	const kinds = selectedElements
		.map((element) => getSelectionKind(element))
		.sort((left, right) => SELECTION_KIND_PRIORITY[left] - SELECTION_KIND_PRIORITY[right]);
	const primaryKind = kinds[0] ?? 'generic';
	const distinctKinds = Array.from(new Set(kinds));
	const primaryCount = kinds.filter((kind) => kind === primaryKind).length;
	const remainderCount = selectedElements.length - primaryCount;
	const label =
		distinctKinds.length === 1
			? `${selectedElements.length} ${getSelectionLabel(primaryKind, selectedElements.length)} selected`
			: `${selectedElements.length} selected`;
	const detail =
		distinctKinds.length === 1
			? 'The assistant will use this automatically when it helps.'
			: `${primaryCount} ${getSelectionLabel(primaryKind, primaryCount)}${remainderCount > 0 ? `, ${remainderCount} more item${remainderCount === 1 ? '' : 's'}` : ''}. The assistant will use this automatically when it helps.`;

	return {
		count: selectedElements.length,
		label,
		detail,
	};
}

export function resolveAssistantContextMode(input: {
	prompt: string;
	selectionCount: number;
}): AssistantContextMode {
	if (input.selectionCount === 0) {
		return 'none';
	}

	const normalized = input.prompt.trim();
	if (!normalized) {
		return 'selected';
	}

	if (WHOLE_CANVAS_PROMPT_PATTERN.test(normalized)) {
		return 'all';
	}

	if (
		SELECTION_DEPENDENT_PROMPT_PATTERN.test(normalized) ||
		SELECTION_TRANSFORM_PROMPT_PATTERN.test(normalized)
	) {
		return 'selected';
	}

	return 'selected';
}

const WHOLE_CANVAS_PROMPT_PATTERN =
	/\b(whole canvas|entire canvas|full canvas|all canvas|the canvas|everything on the canvas|canvas-wide|across the canvas|entire board|whole board)\b/i;
