import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
} from '@ai-canvas/shared/schemas';
import type {
	AssistantContextSnapshot,
	AssistantSelectedContext,
	CanvasElement,
} from '@ai-canvas/shared/types';
import { loadCanvasFromR2 } from '../storage/canvas-storage';
import type { AppEnv } from '../../types';

const SELECTION_CONTEXT_PRIORITY: Record<string, number> = {
	markdown: 1,
	kanban: 2,
	prototype: 3,
	'web-embed': 4,
	'generated-diagram': 5,
	generic: 6,
};
const OVERLAY_TYPES = new Set(['markdown', 'kanban', 'prototype', 'web-embed', 'newlex']);

interface GeneratedDiagramMetadata {
	type: 'ai-generated-diagram';
	language: 'mermaid' | 'd2';
	code: string;
	title?: string;
}

function toElementId(element: CanvasElement): string | null {
	const id = element.id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}

function buildElementLabel(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	const textCandidates = [
		customData?.title,
		customData?.name,
		customData?.content,
		customData?.url,
		element.text,
	];

	for (const candidate of textCandidates) {
		if (typeof candidate === 'string') {
			const normalized = candidate.trim().replace(/\s+/g, ' ');
			if (normalized) {
				return normalized.slice(0, 120);
			}
		}
	}

	return undefined;
}

function getOverlayType(element: CanvasElement): string | undefined {
	const customData = toObjectRecord(element.customData);
	return typeof customData?.type === 'string' && OVERLAY_TYPES.has(customData.type)
		? customData.type
		: undefined;
}

function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
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
		title: typeof customData.title === 'string' ? customData.title : undefined,
	};
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

function compareSelectedElements(a: CanvasElement, b: CanvasElement): number {
	const priorityDiff =
		SELECTION_CONTEXT_PRIORITY[getContextKind(a)] - SELECTION_CONTEXT_PRIORITY[getContextKind(b)];
	if (priorityDiff !== 0) {
		return priorityDiff;
	}

	const labelA = buildElementLabel(a) ?? '';
	const labelB = buildElementLabel(b) ?? '';
	if (labelA !== labelB) {
		return labelA.localeCompare(labelB);
	}

	return String(a.id).localeCompare(String(b.id));
}

function buildSelectedContext(element: CanvasElement): AssistantSelectedContext {
	const overlayType = getOverlayType(element);
	const kind = getContextKind(element);
	const base = {
		id: String(element.id),
		priority: SELECTION_CONTEXT_PRIORITY[kind],
		elementType: typeof element.type === 'string' ? element.type : 'unknown',
		overlayType,
		label: buildElementLabel(element),
	};

	if (kind === 'markdown') {
		return {
			...base,
			kind,
			markdown: normalizeMarkdownOverlay(toObjectRecord(element.customData)),
		};
	}

	if (kind === 'kanban') {
		return {
			...base,
			kind,
			kanban: normalizeKanbanOverlay(toObjectRecord(element.customData)),
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
	};
}

export async function buildAssistantContextSnapshot(
	bindings: AppEnv['Bindings'],
	userId: string,
	canvasId: string,
	selectedElementIds: string[],
): Promise<AssistantContextSnapshot> {
	const canvas = await loadCanvasFromR2(bindings.R2, userId, canvasId);
	if (!canvas) {
		throw new Error('Canvas context not found');
	}

	const selectedIdSet = new Set(selectedElementIds);
	const elements = (canvas.elements ?? []) as CanvasElement[];
	const selectedElements = elements
		.filter((element) => {
			const id = toElementId(element);
			return id ? selectedIdSet.has(id) : false;
		})
		.sort(compareSelectedElements);

	const selectedContexts = selectedElements.map(buildSelectedContext);

	const selectedOverlayTypes = Array.from(
		new Set(selectedElements.map((element) => getOverlayType(element)).filter(Boolean) as string[]),
	);

	return {
		canvasId,
		totalElementCount: elements.length,
		selectedElementIds,
		selectedElementCount: selectedElements.length,
		selectedOverlayTypes,
		selectionSummary: selectedElements.slice(0, 25).map((element) => ({
			id: String(element.id),
			elementType: typeof element.type === 'string' ? element.type : 'unknown',
			overlayType: getOverlayType(element),
			label: buildElementLabel(element),
		})),
		selectedContexts,
	};
}

export function summarizeAssistantContextSnapshot(
	snapshot?: AssistantContextSnapshot,
): string | null {
	if (!snapshot) {
		return null;
	}

	const lines = [
		`Canvas snapshot: ${snapshot.totalElementCount} element${snapshot.totalElementCount === 1 ? '' : 's'}.`,
		`Selected elements: ${snapshot.selectedElementCount}.`,
	];

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

	if (snapshot.selectedContexts.length > 0) {
		lines.push('Selected context details:');
		for (const context of snapshot.selectedContexts) {
			const title = context.label ? ` "${context.label}"` : '';
			if (context.kind === 'markdown') {
				lines.push(`- Markdown${title} (${context.id})`);
				lines.push('```markdown');
				lines.push(context.markdown.content);
				lines.push('```');
				continue;
			}

			if (context.kind === 'kanban') {
				lines.push(`- Kanban board${title} (${context.id})`);
				lines.push('```json');
				lines.push(JSON.stringify(context.kanban, null, 2));
				lines.push('```');
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
		}
	}

	return lines.join('\n');
}
