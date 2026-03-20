/**
 * Summary text formatting for assistant context
 */

import type { AssistantContextSnapshot } from '@ai-canvas/shared/types';

/** Format a count map into a readable string */
export function formatCountMap(prefix: string, values: Record<string, number>): string | null {
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
		lines.push(
			`Canvas summary: ${snapshot.canvasSummary.textBearingElementCount} text-bearing elements, ${snapshot.canvasSummary.editableOverlayCount} editable overlays, ${snapshot.canvasSummary.selectedCount} selected.`,
		);
		const elementTypeLine = formatCountMap(
			'Element types',
			snapshot.canvasSummary.elementTypeCounts,
		);
		if (elementTypeLine) {
			lines.push(elementTypeLine);
		}
		const overlayTypeLine = formatCountMap(
			'Overlay types',
			snapshot.canvasSummary.overlayTypeCounts,
		);
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
