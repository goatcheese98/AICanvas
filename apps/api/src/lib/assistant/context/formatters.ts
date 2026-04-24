/**
 * Summary text formatting for assistant context
 */

import type { AssistantContextSnapshot } from '@ai-canvas/shared/types';

type SummaryLineBuffer = string[];
type CanvasSummary = NonNullable<AssistantContextSnapshot['canvasSummary']>;
type CanvasElementSummary = NonNullable<AssistantContextSnapshot['canvasElementSummaries']>[number];
type SelectionEnvironmentItem = NonNullable<AssistantContextSnapshot['selectionEnvironment']>[number];
type SelectedContext = AssistantContextSnapshot['selectedContexts'][number];
type KanbanContext = Extract<SelectedContext, { kind: 'kanban' }>;

/** Format a count map into a readable string */
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

function formatSelectionLabel(item: {
	elementType: string;
	overlayType?: string;
	label?: string;
}): string {
	const parts = [item.overlayType ?? item.elementType];
	if (item.label) {
		parts.push(`"${item.label}"`);
	}
	return parts.join(' ');
}

function formatCanvasElementLabel(item: CanvasElementSummary): string {
	const parts = [item.overlayType ?? item.elementType];
	if (item.label) {
		parts.push(`"${item.label}"`);
	}
	if (item.textExcerpt && item.textExcerpt !== item.label) {
		parts.push(item.textExcerpt);
	}
	return parts.join(' | ');
}

function formatSelectionEnvironmentLabel(item: SelectionEnvironmentItem): string {
	const parts = [item.overlayType ?? item.elementType];
	if (item.label) {
		parts.push(`"${item.label}"`);
	}
	if (typeof item.distanceFromSelection === 'number') {
		parts.push(`distance ${Math.round(item.distanceFromSelection)}`);
	}
	return parts.join(' | ');
}

function formatContextTitle(context: SelectedContext): string {
	return context.label ? ` "${context.label}"` : '';
}

function appendCanvasSummaryLines(lines: SummaryLineBuffer, canvasSummary: CanvasSummary): void {
	lines.push(
		`Canvas summary: ${canvasSummary.textBearingElementCount} text-bearing elements, ${canvasSummary.editableOverlayCount} editable overlays, ${canvasSummary.selectedCount} selected.`,
	);

	const elementTypeLine = formatCountMap('Element types', canvasSummary.elementTypeCounts);
	if (elementTypeLine) {
		lines.push(elementTypeLine);
	}

	const overlayTypeLine = formatCountMap('Overlay types', canvasSummary.overlayTypeCounts);
	if (overlayTypeLine) {
		lines.push(overlayTypeLine);
	}

	if (canvasSummary.highlights.length > 0) {
		lines.push(`Highlights: ${canvasSummary.highlights.join('; ')}.`);
	}
}

function appendSelectionSummaryLines(
	lines: SummaryLineBuffer,
	selectionSummary: AssistantContextSnapshot['selectionSummary'],
): void {
	if (selectionSummary.length === 0) {
		return;
	}

	lines.push(`Selection summary: ${selectionSummary.map(formatSelectionLabel).join('; ')}.`);
}

function appendRelevantCanvasElementLines(
	lines: SummaryLineBuffer,
	canvasElementSummaries: AssistantContextSnapshot['canvasElementSummaries'],
): void {
	if (!canvasElementSummaries || canvasElementSummaries.length === 0) {
		return;
	}

	lines.push(
		`Relevant canvas elements: ${canvasElementSummaries.map(formatCanvasElementLabel).join('; ')}.`,
	);
}

function appendSelectionEnvironmentLines(
	lines: SummaryLineBuffer,
	selectionEnvironment: AssistantContextSnapshot['selectionEnvironment'],
): void {
	if (!selectionEnvironment || selectionEnvironment.length === 0) {
		return;
	}

	lines.push(
		`Nearby selection context: ${selectionEnvironment
			.map(formatSelectionEnvironmentLabel)
			.join('; ')}.`,
	);
}

function formatKanbanCardDetails(column: KanbanContext['kanbanSummary']['columns'][number]): string {
	return column.cards.length > 0
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
}

function appendMarkdownContextLines(
	lines: SummaryLineBuffer,
	context: Extract<SelectedContext, { kind: 'markdown' }>,
	title: string,
): void {
	lines.push(`- Markdown${title} (${context.id})`);
	lines.push('```markdown');
	lines.push(context.markdown.content);
	lines.push('```');
}

function appendKanbanContextLines(
	lines: SummaryLineBuffer,
	context: KanbanContext,
	title: string,
): void {
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
		lines.push(`Column "${column.title}": ${formatKanbanCardDetails(column)}.`);
	}
}

function appendWebEmbedContextLines(
	lines: SummaryLineBuffer,
	context: Extract<SelectedContext, { kind: 'web-embed' }>,
	title: string,
): void {
	lines.push(`- Web embed${title} (${context.id})`);
	lines.push(`URL: ${context.webEmbed.url}`);
}

function appendPrototypeContextLines(
	lines: SummaryLineBuffer,
	context: Extract<SelectedContext, { kind: 'prototype' }>,
	title: string,
): void {
	lines.push(`- Prototype${title} (${context.id})`);
	lines.push(
		`Template: ${context.prototype.template}; active file: ${context.prototype.activeFile ?? 'none'}.`,
	);
	lines.push(`Files: ${context.prototype.filePaths.join(', ') || 'none'}.`);
	if (context.prototype.dependencies.length > 0) {
		lines.push(`Dependencies: ${context.prototype.dependencies.join(', ')}.`);
	}
}

function appendGeneratedDiagramContextLines(
	lines: SummaryLineBuffer,
	context: Extract<SelectedContext, { kind: 'generated-diagram' }>,
	title: string,
): void {
	lines.push(
		`- Generated ${context.diagram.language === 'mermaid' ? 'Mermaid' : 'D2'} diagram${title} (${context.id})`,
	);
	lines.push(`\`\`\`${context.diagram.language}`);
	lines.push(context.diagram.code);
	lines.push('```');
}

function appendGenericContextLines(
	lines: SummaryLineBuffer,
	context: Extract<SelectedContext, { kind: 'generic' }>,
	title: string,
): void {
	lines.push(`- ${context.overlayType ?? context.elementType}${title} (${context.id})`);
	if (context.generic.text) {
		lines.push(`Text: ${context.generic.text}`);
	}
	if (context.generic.link) {
		lines.push(`Link: ${context.generic.link}`);
	}
}

function appendContextDetailLines(
	lines: SummaryLineBuffer,
	context: SelectedContext,
	title: string,
): void {
	switch (context.kind) {
		case 'markdown':
			appendMarkdownContextLines(lines, context, title);
			break;
		case 'kanban':
			appendKanbanContextLines(lines, context, title);
			break;
		case 'web-embed':
			appendWebEmbedContextLines(lines, context, title);
			break;
		case 'prototype':
			appendPrototypeContextLines(lines, context, title);
			break;
		case 'generated-diagram':
			appendGeneratedDiagramContextLines(lines, context, title);
			break;
		case 'generic':
			appendGenericContextLines(lines, context, title);
			break;
	}
}

function appendSelectedContextLines(
	lines: SummaryLineBuffer,
	selectedContexts: AssistantContextSnapshot['selectedContexts'],
): void {
	if (selectedContexts.length === 0) {
		return;
	}

	lines.push('Selected context details:');

	for (const context of selectedContexts) {
		const title = formatContextTitle(context);

		if (context.textExcerpt && context.textExcerpt !== context.label) {
			lines.push(`Excerpt: ${context.textExcerpt}`);
		}
		appendContextDetailLines(lines, context, title);
	}
}

/** Summarize assistant context snapshot into a human-readable string */
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

	if (snapshot.canvasMeta?.title) {
		lines.push(`Canvas title: "${snapshot.canvasMeta.title}".`);
	}
	if (snapshot.canvasMeta?.description) {
		lines.push(`Canvas description: ${snapshot.canvasMeta.description}.`);
	}
	if (snapshot.canvasSummary) {
		appendCanvasSummaryLines(lines, snapshot.canvasSummary);
	}

	if (snapshot.selectedOverlayTypes.length > 0) {
		lines.push(`Selected overlay types: ${snapshot.selectedOverlayTypes.join(', ')}.`);
	}

	appendSelectionSummaryLines(lines, snapshot.selectionSummary);
	appendRelevantCanvasElementLines(lines, snapshot.canvasElementSummaries);
	appendSelectionEnvironmentLines(lines, snapshot.selectionEnvironment);
	appendSelectedContextLines(lines, snapshot.selectedContexts);

	return lines.join('\n');
}
