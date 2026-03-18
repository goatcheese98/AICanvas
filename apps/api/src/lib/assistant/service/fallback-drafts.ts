import { summarizeAssistantContextSnapshot } from '../context';
import { getLastDiagramArtifact } from '../generation-mode';
import type { AssistantDraft, AssistantServiceInput } from '../types';
import {
	escapeSvgText,
	isCreateNewArtifactIntent,
	sentenceCase,
	slug,
	truncateLabel,
} from './service-utils';

export function buildMermaidDraft(
	message: string,
	contextMode: AssistantServiceInput['contextMode'],
): AssistantDraft {
	const title = sentenceCase(message);
	const root = slug(title);
	const contextNode = contextMode === 'selected' ? 'selected_context' : 'canvas_context';
	const code = [
		'flowchart TD',
		`  ${root}["${title}"]`,
		`  ${contextNode}["${contextMode === 'selected' ? 'Selected elements' : 'Canvas context'}"]`,
		'  next_step["Next step"]',
		`  ${contextNode} --> ${root}`,
		`  ${root} --> next_step`,
	].join('\n');

	return {
		content: ['Generated a Mermaid diagram draft:', '', '```mermaid', code, '```'].join('\n'),
		artifacts: [{ type: 'mermaid', content: code }],
	};
}

export function buildMermaidDraftFromHistory(input: AssistantServiceInput): AssistantDraft | null {
	const previous = getLastDiagramArtifact(input.history);
	if (previous?.mode !== 'mermaid') {
		return null;
	}

	return {
		content: ['Updated the Mermaid diagram draft:', '', '```mermaid', previous.content, '```'].join(
			'\n',
		),
		artifacts: [{ type: 'mermaid', content: previous.content }],
	};
}

export function buildD2Draft(
	message: string,
	contextMode: AssistantServiceInput['contextMode'],
): AssistantDraft {
	const title = sentenceCase(message);
	const code = [
		'title: "AI Canvas Diagram"',
		`request: "${title}"`,
		`${contextMode}: "${contextMode === 'selected' ? 'Selected elements' : 'Canvas context'}"`,
		'result: "Suggested output"',
		`${contextMode} -> request`,
		'request -> result',
	].join('\n');

	return {
		content: ['Generated a D2 diagram draft:', '', '```d2', code, '```'].join('\n'),
		artifacts: [{ type: 'd2', content: code }],
	};
}

export function buildD2DraftFromHistory(input: AssistantServiceInput): AssistantDraft | null {
	const previous = getLastDiagramArtifact(input.history);
	if (previous?.mode !== 'd2') {
		return null;
	}

	return {
		content: ['Updated the D2 diagram draft:', '', '```d2', previous.content, '```'].join('\n'),
		artifacts: [{ type: 'd2', content: previous.content }],
	};
}

function buildKanbanColumnTitles(input: AssistantServiceInput): string[] {
	const selectedKanban = input.contextSnapshot?.selectedContexts.find(
		(context) => context.kind === 'kanban',
	);
	if (selectedKanban && isCreateNewArtifactIntent(input.message)) {
		const titles = selectedKanban.kanbanSummary.columns
			.map((column) => column.title.trim())
			.filter(Boolean)
			.slice(0, 4);
		if (titles.length > 0) {
			return titles;
		}
	}

	const corpus = [
		input.message,
		...(input.contextSnapshot?.canvasSummary?.highlights ?? []),
		...(input.contextSnapshot?.selectedContexts ?? []).flatMap((context) => {
			if (context.kind === 'markdown') {
				return [context.markdown.title ?? '', context.markdown.content];
			}
			if (context.kind === 'kanban') {
				return [context.kanban.title, ...context.kanban.columns.map((column) => column.title)];
			}
			if (context.kind === 'prototype') {
				return [context.prototype.title, ...context.prototype.filePaths];
			}
			return [context.label ?? '', context.textExcerpt ?? ''];
		}),
	]
		.join('\n')
		.toLowerCase();

	if (/(backlog|to do|todo|in progress|doing|done|complete|completed|review)/.test(corpus)) {
		return ['To Do', 'In Progress', 'Done'];
	}

	if (/(research|build|review|ship|launch)/.test(corpus)) {
		return ['Research', 'Build', 'Review', 'Ship'];
	}

	return ['To Do', 'In Progress', 'Done'];
}

function extractTaskCandidatesFromMarkdown(content: string): string[] {
	return content
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) =>
			line
				.replace(/^[-*+]\s+/, '')
				.replace(/^\d+\.\s+/, '')
				.replace(/^#+\s+/, '')
				.trim(),
		)
		.filter((line) => line.length > 3)
		.slice(0, 12);
}

function buildKanbanCardSeeds(input: AssistantServiceInput): Array<{
	title: string;
	description?: string;
	priority?: 'low' | 'medium' | 'high';
	labels?: string[];
}> {
	const seeds: Array<{
		title: string;
		description?: string;
		priority?: 'low' | 'medium' | 'high';
		labels?: string[];
	}> = [];

	for (const context of input.contextSnapshot?.selectedContexts ?? []) {
		if (context.kind === 'markdown') {
			for (const item of extractTaskCandidatesFromMarkdown(context.markdown.content)) {
				seeds.push({ title: truncateLabel(item, 56), labels: ['Notes'] });
			}
			continue;
		}

		if (context.kind === 'kanban' && isCreateNewArtifactIntent(input.message)) {
			for (const column of context.kanbanSummary.columns) {
				for (const card of column.cards.slice(0, 3)) {
					seeds.push({
						title: truncateLabel(card.title, 56),
						priority: card.priority,
						labels: card.labels.slice(0, 2),
					});
				}
			}
			continue;
		}

		if (context.kind === 'prototype') {
			seeds.push(
				{ title: `Map ${context.prototype.title}`, labels: ['Prototype'] },
				{ title: 'Review key screens', labels: ['Prototype'] },
				{ title: 'Validate primary interaction flow', labels: ['Prototype'] },
			);
			continue;
		}

		const label = context.label ?? context.textExcerpt;
		if (label) {
			seeds.push({
				title: truncateLabel(label, 56),
				description:
					context.textExcerpt && context.textExcerpt !== label ? context.textExcerpt : undefined,
			});
		}
	}

	if (seeds.length === 0) {
		for (const highlight of input.contextSnapshot?.canvasSummary?.highlights ?? []) {
			seeds.push({ title: truncateLabel(highlight, 56), labels: ['Canvas'] });
			if (seeds.length >= 6) {
				break;
			}
		}
	}

	if (seeds.length === 0) {
		seeds.push(
			{
				title: truncateLabel(input.message, 56),
				description: 'Generated from the assistant request',
				priority: /high|urgent|critical/i.test(input.message) ? 'high' : 'medium',
			},
			{
				title: 'Clarify scope',
				description: 'Capture the concrete outcome this board should support.',
			},
			{ title: 'Define the next step', description: 'Turn the first obvious move into a card.' },
		);
	}

	return seeds.slice(0, 9);
}

export function buildKanbanDraft(input: AssistantServiceInput): AssistantDraft {
	const columns = buildKanbanColumnTitles(input);
	const seeds = buildKanbanCardSeeds(input);
	const ops: Array<Record<string, unknown>> = columns.map((title, index) => ({
		op: 'add_column',
		column: {
			id: slug(title) || `column-${index + 1}`,
			title,
		},
	}));

	const primaryColumnId = String((ops[0] as { column: { id: string } }).column.id);
	for (const seed of seeds) {
		ops.push({
			op: 'add_card',
			columnId: primaryColumnId,
			card: {
				title: seed.title,
				description: seed.description,
				priority: seed.priority ?? 'medium',
				labels: seed.labels,
			},
		});
	}
	const serialized = JSON.stringify(ops, null, 2);

	return {
		content: ['Generated kanban operations:', '', '```json', serialized, '```'].join('\n'),
		artifacts: [{ type: 'kanban-ops', content: serialized }],
	};
}

export function buildChatDraft(input: AssistantServiceInput): AssistantDraft {
	const contextSummary =
		input.contextMode === 'none' ? null : summarizeAssistantContextSnapshot(input.contextSnapshot);
	return {
		content: [
			`Working in ${
				input.contextMode === 'selected'
					? 'selected-context'
					: input.contextMode === 'all'
						? 'whole-canvas'
						: 'no-canvas-context'
			} mode.`,
			'',
			`Request: ${sentenceCase(input.message)}`,
			...(contextSummary ? ['', contextSummary] : []),
			'',
			'Suggested next step: turn this into a structured overlay, diagram, or kanban operation if you want a concrete canvas mutation.',
		].join('\n'),
	};
}

export function buildImageRunDraft(
	input: AssistantServiceInput,
	mode: 'image' | 'sketch',
): AssistantDraft {
	return {
		content: [
			`Prepared a ${mode === 'sketch' ? 'sketch' : 'multimodal image'} run.`,
			'',
			`Request: ${sentenceCase(input.message)}`,
			'',
			'The executor can attach a generated asset that stays in chat until you choose to insert it.',
		].join('\n'),
	};
}

export function buildSvgPlaceholderDraft(input: AssistantServiceInput): AssistantDraft {
	const requestLabel = sentenceCase(input.message);
	return {
		content: [
			'Prepared an SVG illustration draft for the canvas.',
			'',
			`Request: ${requestLabel}`,
			'',
			'```svg',
			[
				'<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg">',
				'  <rect width="480" height="320" rx="24" fill="#f8fafc"/>',
				'  <rect x="36" y="120" width="180" height="132" rx="28" fill="#dbeafe"/>',
				'  <circle cx="312" cy="174" r="54" fill="#bfdbfe"/>',
				'  <path d="M252 252h120" stroke="#2563eb" stroke-width="18" stroke-linecap="round"/>',
				`  <text x="36" y="70" fill="#0f172a" font-family="Arial, sans-serif" font-size="24" font-weight="600">${escapeSvgText(requestLabel)}</text>`,
				'  <text x="36" y="98" fill="#475569" font-family="Arial, sans-serif" font-size="14">SVG placeholder draft. Refine with a more specific style or subject request.</text>',
				'</svg>',
			].join('\n'),
			'```',
		].join('\n'),
	};
}
