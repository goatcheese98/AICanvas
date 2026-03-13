import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
	summarizeKanbanOverlay,
} from '@ai-canvas/shared/schemas';
import type {
	AssistantCanvasBounds,
	AssistantCanvasElementSummary,
	AssistantCanvasMeta,
	AssistantCanvasStyleHints,
	AssistantCanvasSummary,
	AssistantContextMode,
	AssistantContextSnapshot,
	AssistantSelectedContext,
	CanvasElement,
} from '@ai-canvas/shared/types';
import { loadCanvasFromR2 } from '../storage/canvas-storage';
import type { AppEnv } from '../../types';

const SELECTION_CONTEXT_PRIORITY: Record<AssistantSelectedContext['kind'], number> = {
	markdown: 1,
	kanban: 2,
	prototype: 3,
	'web-embed': 4,
	'generated-diagram': 5,
	generic: 6,
};

const OVERLAY_TYPES = new Set(['markdown', 'kanban', 'prototype', 'web-embed', 'newlex']);
const EDITABLE_OVERLAY_TYPES = new Set(['markdown', 'kanban', 'prototype']);
const CANVAS_HIGHLIGHT_LIMIT = 12;
const CANVAS_ELEMENT_SUMMARY_LIMIT = 18;
const SELECTION_ENVIRONMENT_LIMIT = 8;
const SELECTION_SUMMARY_LIMIT = 25;
const TEXT_EXCERPT_LIMIT = 320;

interface BuildAssistantContextSnapshotInput {
	canvasId: string;
	contextMode: AssistantContextMode;
	selectedElementIds: string[];
	canvasMeta?: AssistantCanvasMeta;
}

interface GeneratedDiagramMetadata {
	type: 'ai-generated-diagram';
	language: 'mermaid' | 'd2';
	code: string;
	title?: string;
}

function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function toElementId(element: CanvasElement): string | null {
	const id = element.id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}

function normalizeText(value: unknown, maxLength = 240): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = value.trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return undefined;
	}

	return normalized.slice(0, maxLength);
}

function getOverlayType(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	return typeof customData?.type === 'string' && OVERLAY_TYPES.has(customData.type)
		? customData.type
		: undefined;
}

function getOverlayLikeType(element: CanvasElement): string | undefined {
	return getOverlayType(element) ?? (parseGeneratedDiagramMetadata(element) ? 'generated-diagram' : undefined);
}

function parseGeneratedDiagramMetadata(element: CanvasElement): GeneratedDiagramMetadata | null {
	const customData = toObjectRecord(element.customData);
	if (customData?.type !== 'ai-generated-diagram') {
		return null;
	}

	const language = customData.language;
	const code = customData.code;
	if ((language !== 'mermaid' && language !== 'd2') || typeof code !== 'string' || code.trim().length === 0) {
		return null;
	}

	return {
		type: 'ai-generated-diagram',
		language,
		code: code.trim(),
		title: normalizeText(customData.title, 240),
	};
}

function getElementType(element: CanvasElement): string {
	return typeof element.type === 'string' ? element.type : 'unknown';
}

function buildElementLabel(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	const textCandidates = [customData?.title, customData?.name, element.text, customData?.content, customData?.url];

	for (const candidate of textCandidates) {
		const normalized = normalizeText(candidate, 120);
		if (normalized) {
			return normalized;
		}
	}

	return undefined;
}

function buildElementTextExcerpt(element: CanvasElement): string | undefined {
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

function buildBounds(element: CanvasElement): AssistantCanvasBounds | undefined {
	const x = typeof element.x === 'number' ? element.x : undefined;
	const y = typeof element.y === 'number' ? element.y : undefined;
	if (typeof x !== 'number' || typeof y !== 'number') {
		return undefined;
	}

	const width = typeof element.width === 'number' ? Math.abs(element.width) : 0;
	const height = typeof element.height === 'number' ? Math.abs(element.height) : 0;
	return { x, y, width, height };
}

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

function buildStyleHints(element: CanvasElement): AssistantCanvasStyleHints | undefined {
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

function getContextKind(element: CanvasElement): AssistantSelectedContext['kind'] {
	const overlayType = getOverlayType(element);
	if (overlayType === 'markdown') return 'markdown';
	if (overlayType === 'kanban') return 'kanban';
	if (overlayType === 'prototype') return 'prototype';
	if (overlayType === 'web-embed') return 'web-embed';
	if (parseGeneratedDiagramMetadata(element)) return 'generated-diagram';
	return 'generic';
}

function getElementSortLabel(element: CanvasElement): string {
	return buildElementLabel(element) ?? buildElementTextExcerpt(element) ?? '';
}

function compareByPriorityAndLabel(a: CanvasElement, b: CanvasElement): number {
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

function buildElementSummary(
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

function buildGenericContextPayload(element: CanvasElement) {
	const customData = toObjectRecord(element.customData);
	const text = buildElementTextExcerpt(element);
	return {
		shapeType: getElementType(element),
		text,
		link:
			normalizeText(element.link, 2000)
			?? normalizeText(customData?.url, 2000)
			?? normalizeText(customData?.href, 2000),
		hasImageFile:
			typeof element.fileId === 'string'
			|| typeof customData?.fileId === 'string'
			|| getElementType(element) === 'image',
		customDataType: typeof customData?.type === 'string' ? customData.type : undefined,
		isConnector: getElementType(element) === 'arrow' || getElementType(element) === 'line',
		isFrame: getElementType(element) === 'frame',
	};
}

function buildSelectedContext(element: CanvasElement): AssistantSelectedContext {
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

function getSelectionBounds(elements: CanvasElement[]): AssistantCanvasBounds | undefined {
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

function rectDistance(a: AssistantCanvasBounds, b: AssistantCanvasBounds): number {
	const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
	const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
	return Math.sqrt(dx * dx + dy * dy);
}

function buildSelectionEnvironment(
	elements: CanvasElement[],
	selectedIdSet: Set<string>,
	selectedBounds?: AssistantCanvasBounds,
): AssistantCanvasElementSummary[] | undefined {
	if (!selectedBounds) {
		return undefined;
	}

	const candidates = elements
		.filter((element) => {
			const id = toElementId(element);
			return id ? !selectedIdSet.has(id) : false;
		})
		.map((element) => {
			const bounds = buildBounds(element);
			const distance = bounds ? rectDistance(selectedBounds, bounds) : Number.POSITIVE_INFINITY;
			return { element, distance };
		})
		.filter((candidate) => Number.isFinite(candidate.distance))
		.sort((left, right) => {
			if (left.distance !== right.distance) {
				return left.distance - right.distance;
			}
			return compareByPriorityAndLabel(left.element, right.element);
		})
		.slice(0, SELECTION_ENVIRONMENT_LIMIT)
		.map((candidate) => buildElementSummary(candidate.element, candidate.distance));

	return candidates.length > 0 ? candidates : undefined;
}

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

function buildCanvasElementSummaries(
	elements: CanvasElement[],
	selectedIdSet: Set<string>,
): AssistantCanvasElementSummary[] | undefined {
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

function incrementCount(map: Record<string, number>, key: string | undefined) {
	if (!key) {
		return;
	}

	map[key] = (map[key] ?? 0) + 1;
}

function buildCanvasSummary(
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

export async function buildAssistantContextSnapshot(
	bindings: AppEnv['Bindings'],
	userId: string,
	input: BuildAssistantContextSnapshotInput,
): Promise<AssistantContextSnapshot> {
	const canvas = await loadCanvasFromR2(bindings.R2, userId, input.canvasId);
	if (!canvas) {
		throw new Error('Canvas context not found');
	}

	const selectedIdSet = new Set(input.selectedElementIds);
	const elements = (canvas.elements ?? []) as CanvasElement[];
	const selectedElements = elements
		.filter((element) => {
			const id = toElementId(element);
			return id ? selectedIdSet.has(id) : false;
		})
		.sort(compareByPriorityAndLabel);
	const selectedContexts =
		input.contextMode === 'none' ? [] : selectedElements.map(buildSelectedContext);
	const selectedBounds = getSelectionBounds(selectedElements);
	const selectedOverlayTypes = Array.from(
		new Set(selectedElements.map((element) => getOverlayType(element)).filter(Boolean) as string[]),
	);

	return {
		canvasId: input.canvasId,
		totalElementCount: elements.length,
		selectedElementIds: input.selectedElementIds,
		selectedElementCount: selectedElements.length,
		selectedOverlayTypes,
		canvasMeta: input.canvasMeta,
		canvasSummary:
			input.contextMode === 'none' ? undefined : buildCanvasSummary(elements, selectedElements.length),
		canvasElementSummaries:
			input.contextMode === 'all' ? buildCanvasElementSummaries(elements, selectedIdSet) : undefined,
		selectionEnvironment:
			input.contextMode === 'none'
				? undefined
				: buildSelectionEnvironment(elements, selectedIdSet, selectedBounds),
		selectionSummary: selectedElements.slice(0, SELECTION_SUMMARY_LIMIT).map((element) => ({
			id: String(element.id),
			elementType: getElementType(element),
			overlayType: getOverlayLikeType(element),
			label: buildElementLabel(element),
		})),
		selectedContexts,
	};
}

function formatCountMap(prefix: string, values: Record<string, number>): string | null {
	const entries = Object.entries(values).sort((left, right) => {
		if (right[1] !== left[1]) {
			return right[1] - left[1];
		}
		return left[0].localeCompare(right[0]);
	});
	if (entries.length === 0) {
		return null;
	}

	return `${prefix}: ${entries.map(([key, count]) => `${key} ${count}`).join(', ')}.`;
}

export function summarizeAssistantContextSnapshot(snapshot?: AssistantContextSnapshot): string | null {
	if (!snapshot) {
		return null;
	}

	const lines = [
		`Canvas snapshot: ${snapshot.totalElementCount} element${snapshot.totalElementCount === 1 ? '' : 's'}.`,
		`Selected elements: ${snapshot.selectedElementCount}.`,
	];

	if (snapshot.canvasMeta?.title) {
		lines.push(`Canvas title: "${snapshot.canvasMeta.title}".`);
	}
	if (snapshot.canvasMeta?.description) {
		lines.push(`Canvas description: ${snapshot.canvasMeta.description}.`);
	}
	if (snapshot.canvasSummary) {
		lines.push(
			`Canvas summary: ${snapshot.canvasSummary.textBearingElementCount} text-bearing elements, ${snapshot.canvasSummary.editableOverlayCount} editable overlays, ${snapshot.canvasSummary.selectedCount} selected.`,
		);
		const elementTypeLine = formatCountMap('Element types', snapshot.canvasSummary.elementTypeCounts);
		if (elementTypeLine) {
			lines.push(elementTypeLine);
		}
		const overlayTypeLine = formatCountMap('Overlay types', snapshot.canvasSummary.overlayTypeCounts);
		if (overlayTypeLine) {
			lines.push(overlayTypeLine);
		}
		if (snapshot.canvasSummary.highlights.length > 0) {
			lines.push(`Highlights: ${snapshot.canvasSummary.highlights.join('; ')}.`);
		}
	}

	if (snapshot.selectedOverlayTypes.length > 0) {
		lines.push(`Selected overlay types: ${snapshot.selectedOverlayTypes.join(', ')}.`);
	}

	if (snapshot.selectionSummary.length > 0) {
		lines.push(
			`Selection summary: ${snapshot.selectionSummary
				.map((item) => {
					const parts = [item.overlayType ?? item.elementType];
					if (item.label) {
						parts.push(`"${item.label}"`);
					}
					return parts.join(' ');
				})
				.join('; ')}.`,
		);
	}

	const canvasElementSummaries = snapshot.canvasElementSummaries ?? [];
	if (canvasElementSummaries.length > 0) {
		lines.push(
			`Relevant canvas elements: ${canvasElementSummaries
				.map((item) => {
					const parts = [item.overlayType ?? item.elementType];
					if (item.label) {
						parts.push(`"${item.label}"`);
					}
					if (item.textExcerpt && item.textExcerpt !== item.label) {
						parts.push(item.textExcerpt);
					}
					return parts.join(' | ');
				})
				.join('; ')}.`,
		);
	}

	const selectionEnvironment = snapshot.selectionEnvironment ?? [];
	if (selectionEnvironment.length > 0) {
		lines.push(
			`Nearby selection context: ${selectionEnvironment
				.map((item) => {
					const parts = [item.overlayType ?? item.elementType];
					if (item.label) {
						parts.push(`"${item.label}"`);
					}
					if (typeof item.distanceFromSelection === 'number') {
						parts.push(`distance ${Math.round(item.distanceFromSelection)}`);
					}
					return parts.join(' | ');
				})
				.join('; ')}.`,
		);
	}

	if (snapshot.selectedContexts.length > 0) {
		lines.push('Selected context details:');
		for (const context of snapshot.selectedContexts) {
			const title = context.label ? ` "${context.label}"` : '';
			if (context.textExcerpt && context.textExcerpt !== context.label) {
				lines.push(`Excerpt: ${context.textExcerpt}`);
			}
			if (context.kind === 'markdown') {
				lines.push(`- Markdown${title} (${context.id})`);
				lines.push('```markdown');
				lines.push(context.markdown.content);
				lines.push('```');
				continue;
			}

			if (context.kind === 'kanban') {
				lines.push(`- Kanban board${title} (${context.id})`);
				lines.push(
					`Summary: ${context.kanbanSummary.columnCount} columns, ${context.kanbanSummary.cardCount} cards, ${context.kanbanSummary.emptyColumnCount} empty columns, ${context.kanbanSummary.overdueCardCount} overdue cards.`,
				);
				lines.push(
					`Priorities: low ${context.kanbanSummary.priorityCounts.low}, medium ${context.kanbanSummary.priorityCounts.medium}, high ${context.kanbanSummary.priorityCounts.high}.`,
				);
				if (context.kanbanSummary.labels.length > 0) {
					lines.push(`Labels: ${context.kanbanSummary.labels.join(', ')}.`);
				}
				for (const column of context.kanbanSummary.columns) {
					const cards =
						column.cards.length > 0
							? column.cards
									.map((card) => {
										const parts = [`"${card.title}"`, card.priority];
										if (card.isOverdue) {
											parts.push('overdue');
										}
										if (card.totalChecklistItemCount > 0) {
											parts.push(
												`checklist ${card.completedChecklistItemCount}/${card.totalChecklistItemCount}`,
											);
										}
										if (card.labels.length > 0) {
											parts.push(`labels: ${card.labels.join(', ')}`);
										}
										return parts.join(' | ');
									})
									.join('; ')
							: 'no cards';
					lines.push(`Column "${column.title}": ${cards}.`);
				}
				continue;
			}

			if (context.kind === 'web-embed') {
				lines.push(`- Web embed${title} (${context.id})`);
				lines.push(`URL: ${context.webEmbed.url}`);
				continue;
			}

			if (context.kind === 'prototype') {
				lines.push(`- Prototype${title} (${context.id})`);
				lines.push(
					`Template: ${context.prototype.template}; active file: ${context.prototype.activeFile ?? 'none'}.`,
				);
				lines.push(`Files: ${context.prototype.filePaths.join(', ') || 'none'}.`);
				if (context.prototype.dependencies.length > 0) {
					lines.push(`Dependencies: ${context.prototype.dependencies.join(', ')}.`);
				}
				continue;
			}

			if (context.kind === 'generated-diagram') {
				lines.push(
					`- Generated ${context.diagram.language === 'mermaid' ? 'Mermaid' : 'D2'} diagram${title} (${context.id})`,
				);
				lines.push(`\`\`\`${context.diagram.language}`);
				lines.push(context.diagram.code);
				lines.push('```');
				continue;
			}

			lines.push(`- ${context.overlayType ?? context.elementType}${title} (${context.id})`);
			if (context.generic.text) {
				lines.push(`Text: ${context.generic.text}`);
			}
			if (context.generic.link) {
				lines.push(`Link: ${context.generic.link}`);
			}
		}
	}

	return lines.join('\n');
}
