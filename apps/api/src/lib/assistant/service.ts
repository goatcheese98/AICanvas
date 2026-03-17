import { normalizeKanbanOverlay, normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantKanbanPatchArtifact,
	AssistantMarkdownPatchArtifact,
	AssistantMessage,
	AssistantSelectedContext,
	GenerationMode,
	KanbanOverlayCustomData,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import { nanoid } from 'nanoid';
import { createAnthropicMessage } from './anthropic';
import { summarizeAssistantContextSnapshot } from './context';
export { resolveGenerationMode } from './generation-mode';
import {
	buildAnthropicConversation,
	getLastDiagramArtifact,
	getLastSvgSource,
	inferPrototypeTemplate,
	resolveGenerationMode,
} from './generation-mode';
import {
	buildD2EditPrompt,
	buildD2Prompt,
	buildKanbanPrompt,
	buildMarkdownRewritePrompt,
	buildMermaidEditPrompt,
	buildMermaidPrompt,
	buildPrototypePrompt,
	buildSvgEditPrompt,
	buildSvgPrompt,
	extractCodeBlock,
} from './parsing';
import type { AssistantDraft, AssistantServiceInput, AssistantServiceResult } from './types';

function sentenceCase(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	if (!trimmed) return 'Untitled';
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function escapeSvgText(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function slug(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 24) || 'node'
	);
}

function truncateLabel(text: string, max = 56): string {
	const normalized = sentenceCase(text).replace(/\s+/g, ' ');
	return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function normalizeSource(value?: string): string {
	return (value ?? '').replace(/\r\n/g, '\n').trim();
}

function isEditableSelectionRequest(message: string): boolean {
	return /(add|adjust|change|clean up|condense|convert|edit|expand|fix|improve|move|organize|polish|priorit|refine|rename|reorder|rewrite|summari[sz]e|turn this into|update)/i.test(
		message,
	);
}

function isCreateNewArtifactIntent(message: string): boolean {
	return /\b(new\s+(board|kanban|note|prototype)|create\s+(a\s+)?new|from this|based on this|turn this into|make (?:a|an)\b)/i.test(
		message,
	);
}

function getSelectedEditableContexts(input: AssistantServiceInput): AssistantSelectedContext[] {
	return (input.contextSnapshot?.selectedContexts ?? []).filter(
		(context) => context.kind === 'markdown' || context.kind === 'kanban',
	);
}

function normalizeMarkdownComparableText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[`*_>#-]/g, ' ')
		.replace(/\[[ xX]\]/g, ' ')
		.replace(/[^\w\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractMarkdownResponseContent(value: string): string {
	return extractCodeBlock(value, 'markdown') ?? value.trim();
}

function extractRemovalSectionTarget(message: string): string | null {
	const match = message.match(/\bremove\s+(?:the\s+)?(.+?)\s+section\b/i);
	return match?.[1]?.trim() || null;
}

function removeMarkdownSection(
	content: string,
	targetSection: string,
): { content: string; removed: boolean } {
	const lines = content.split('\n');
	const normalizedTarget = normalizeMarkdownComparableText(targetSection);
	const headingPattern = /^\s{0,3}(#{1,6})\s+(.*)$/;
	const startIndex = lines.findIndex((line) => {
		const match = line.match(headingPattern);
		return match && normalizeMarkdownComparableText(match[2] ?? '') === normalizedTarget;
	});

	if (startIndex === -1) {
		return { content, removed: false };
	}

	const startLevel = lines[startIndex]?.match(headingPattern)?.[1].length ?? 1;
	let endIndex = lines.length;
	for (let index = startIndex + 1; index < lines.length; index += 1) {
		const match = lines[index]?.match(headingPattern);
		if (match && match[1].length <= startLevel) {
			endIndex = index;
			break;
		}
	}

	const nextLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
	return {
		content: nextLines
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim(),
		removed: true,
	};
}

function extractUnavailableItems(message: string): string[] {
	const patterns = [
		/\b(?:do not have|don't have|dont have|without|no)\s+(.+?)(?:[?.!]|$)/i,
		/\bremove\s+(?:the\s+)?(.+?)(?:\s+from\b|[?.!]|$)/i,
	];

	for (const pattern of patterns) {
		const match = message.match(pattern);
		if (!match?.[1]) {
			continue;
		}

		return match[1]
			.split(/,| and | or /i)
			.map((item) =>
				item
					.replace(
						/\b(the|a|an|any|section|list|grocery|groceries|ingredients?|please|actually|can you|could you)\b/gi,
						' ',
					)
					.replace(/\s+/g, ' ')
					.trim(),
			)
			.filter((item) => item.length > 1);
	}

	return [];
}

function removeMarkdownListItems(
	currentContent: string,
	targets: string[],
): { content: string; removedCount: number } {
	if (targets.length === 0) {
		return { content: currentContent, removedCount: 0 };
	}

	const normalizedTargets = targets.map((target) => normalizeMarkdownComparableText(target));
	const lines = currentContent.split('\n');
	let removedCount = 0;
	const nextLines = lines.filter((line) => {
		if (!/^(\s*)[-*+]\s|^(\s*)\d+\.\s/.test(line) && !/^\s*[-*+]\s+\[[ xX]\]\s/.test(line)) {
			return true;
		}

		const comparableLine = normalizeMarkdownComparableText(line);
		const shouldRemove = normalizedTargets.some(
			(target) => comparableLine.includes(target) || target.includes(comparableLine),
		);
		if (shouldRemove) {
			removedCount += 1;
			return false;
		}

		return true;
	});

	return {
		content: nextLines
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim(),
		removedCount,
	};
}

function buildMarkdownPatchResult(
	currentContent: string,
	message: string,
): { content: string; summary: string } {
	const sectionTarget = extractRemovalSectionTarget(message);
	if (sectionTarget) {
		const sectionRemoval = removeMarkdownSection(currentContent, sectionTarget);
		if (sectionRemoval.removed) {
			return {
				content: sectionRemoval.content,
				summary: `Removes the "${truncateLabel(sectionTarget, 40)}" section from the selected markdown note.`,
			};
		}
	}

	const unavailableItems = extractUnavailableItems(message);
	if (unavailableItems.length > 0) {
		const listRemoval = removeMarkdownListItems(currentContent, unavailableItems);
		if (listRemoval.removedCount > 0) {
			return {
				content: listRemoval.content,
				summary:
					listRemoval.removedCount === 1
						? 'Removes one matching list item from the selected markdown note.'
						: `Removes ${listRemoval.removedCount} matching list items from the selected markdown note.`,
			};
		}
	}

	const normalized = normalizeSource(currentContent);
	const sectionTitle = /summari[sz]e/i.test(message) ? 'AI Summary' : 'AI Update';
	const note = truncateLabel(message, 160);
	const separator = normalized.length > 0 ? '\n\n' : '';
	return {
		content: `${normalized}${separator}## ${sectionTitle}\n\n- ${note}\n`.trim(),
		summary: /summari[sz]e/i.test(message)
			? 'Adds an AI summary section to the selected markdown note.'
			: 'Adds an AI update section to the selected markdown note.',
	};
}

function validateMarkdownRewrite(params: {
	original: string;
	rewritten: string;
	message: string;
}): boolean {
	const rewritten = normalizeSource(params.rewritten);
	const original = normalizeSource(params.original);
	if (!rewritten || rewritten.length < 8) {
		return false;
	}

	if (rewritten === original) {
		return false;
	}

	const normalizedPrompt = normalizeMarkdownComparableText(params.message);
	const normalizedRewrite = normalizeMarkdownComparableText(rewritten);
	if (
		normalizedPrompt.length > 0 &&
		normalizedRewrite.includes(normalizedPrompt) &&
		rewritten.length < original.length + Math.max(60, params.message.length * 2)
	) {
		return false;
	}

	const sectionTarget = extractRemovalSectionTarget(params.message);
	if (sectionTarget) {
		const normalizedSection = normalizeMarkdownComparableText(sectionTarget);
		const stillHasSection = rewritten.split('\n').some((line) => {
			const match = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
			return match && normalizeMarkdownComparableText(match[2] ?? '') === normalizedSection;
		});
		if (stillHasSection) {
			return false;
		}
	}

	const unavailableItems = extractUnavailableItems(params.message);
	if (unavailableItems.length > 0) {
		const normalizedRewriteLines = rewritten
			.split('\n')
			.map((line) => normalizeMarkdownComparableText(line));
		const stillHasUnavailableItem = unavailableItems.some((item) => {
			const normalizedItem = normalizeMarkdownComparableText(item);
			return normalizedRewriteLines.some((line) => line.includes(normalizedItem));
		});
		if (stillHasUnavailableItem) {
			return false;
		}
	}

	return true;
}

async function createMarkdownPatchArtifact(
	context: Extract<AssistantSelectedContext, { kind: 'markdown' }>,
	message: string,
	bindings?: AssistantServiceInput['bindings'],
): Promise<AssistantArtifact> {
	let patchResult: { content: string; summary: string } | null = null;

	if (bindings?.ANTHROPIC_API_KEY) {
		try {
			const completion = await createAnthropicMessage(bindings, {
				system: [
					'You are AI Canvas, editing a selected markdown note.',
					'Produce exact, useful document rewrites with no meta commentary.',
					'Return only the revised markdown document.',
				].join('\n'),
				messages: [
					{
						role: 'user',
						content: buildMarkdownRewritePrompt(message, context.markdown.content),
					},
				],
				maxTokens: 2200,
			});
			const rewrittenMarkdown = extractMarkdownResponseContent(completion.text);
			if (
				validateMarkdownRewrite({
					original: context.markdown.content,
					rewritten: rewrittenMarkdown,
					message,
				})
			) {
				patchResult = {
					content: rewrittenMarkdown,
					summary: 'Rewrites the selected markdown note to satisfy the edit request.',
				};
			}
		} catch {
			// Fall back to the local structural editor if model-assisted rewriting fails.
		}
	}

	if (!patchResult) {
		patchResult = buildMarkdownPatchResult(context.markdown.content, message);
	}
	const patch: AssistantMarkdownPatchArtifact = {
		kind: 'markdown_patch',
		targetId: context.id,
		summary: patchResult.summary,
		base: {
			title: context.markdown.title,
			content: context.markdown.content,
		},
		next: {
			title: context.markdown.title,
			content: patchResult.content,
			images: context.markdown.images,
			settings: context.markdown.settings,
			editorMode: context.markdown.editorMode,
		},
	};

	return {
		type: 'markdown-patch',
		content: JSON.stringify(patch, null, 2),
	};
}

function findKanbanTargetColumn(board: KanbanOverlayCustomData, message: string) {
	const normalizedMessage = message.toLowerCase();
	if (board.columns.length === 0) {
		return null;
	}

	// Substring match against actual column titles (case-insensitive)
	for (const column of board.columns) {
		if (normalizedMessage.includes(column.title.toLowerCase())) {
			return column;
		}
	}

	// Keyword heuristics for common status columns
	if (/(done|complete|completed|ship|closed)/.test(normalizedMessage)) {
		return board.columns.at(-1) ?? board.columns[0] ?? null;
	}

	if (/(progress|active|working|doing)/.test(normalizedMessage)) {
		return board.columns[1] ?? board.columns[0] ?? null;
	}

	return board.columns[0] ?? null;
}

/**
 * Detect "move [card title] to [column name]" patterns.
 * Returns { cardId, targetColumnId } when matched, otherwise null.
 */
function detectMoveCardIntent(
	board: KanbanOverlayCustomData,
	message: string,
): { cardId: string; targetColumnId: string } | null {
	const match = message.match(/\bmove\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i);
	if (!match) return null;

	const cardQuery = match[1]?.trim().toLowerCase();
	const columnQuery = match[2]?.trim().toLowerCase();
	if (!cardQuery || !columnQuery) return null;

	// Find matching column (substring match on title)
	const targetColumn = board.columns.find(
		(column) =>
			column.title.toLowerCase().includes(columnQuery) ||
			columnQuery.includes(column.title.toLowerCase()),
	);
	if (!targetColumn) return null;

	// Find matching card across all columns (substring match on title)
	for (const column of board.columns) {
		const card = column.cards.find((c) => c.title.toLowerCase().includes(cardQuery));
		if (card) {
			return { cardId: card.id, targetColumnId: targetColumn.id };
		}
	}

	return null;
}

/**
 * Detect "remove/delete [card title]" patterns.
 * Returns the cardId when matched, otherwise null.
 */
function detectRemoveCardIntent(board: KanbanOverlayCustomData, message: string): string | null {
	const match = message.match(
		/\b(?:remove|delete)\s+(?:the\s+card\s+)?(.+?)(?:\s+card)?(?:[.!?]|$)/i,
	);
	if (!match) return null;

	const cardQuery = match[1]?.trim().toLowerCase();
	if (!cardQuery) return null;

	for (const column of board.columns) {
		const card = column.cards.find((c) => c.title.toLowerCase().includes(cardQuery));
		if (card) return card.id;
	}

	return null;
}

function buildKanbanEditPrompt(userText: string, boardJson: string): string {
	return [
		'You are editing a Kanban board. Return ONLY the full updated board as valid JSON matching the KanbanOverlayCustomData schema.',
		'Rules:',
		'- Preserve all existing card and column IDs unless explicitly removing cards/columns.',
		'- New cards must have unique string IDs (use short random-looking strings).',
		'- The response must be a single JSON object with: type, title, columns, and optional bgTheme/fontId/fontSize.',
		'- Each column has: id, title, color (optional), cards[].',
		'- Each card has: id, title, description, priority (low/medium/high), labels[], dueDate (optional ISO string), checklist[].',
		'- Do not include markdown fences or any text outside the JSON object.',
		'',
		`User request: ${userText}`,
		'',
		'Current board JSON:',
		boardJson,
	].join('\n');
}

async function createKanbanPatchArtifact(
	context: Extract<AssistantSelectedContext, { kind: 'kanban' }>,
	message: string,
	bindings?: AssistantServiceInput['bindings'],
): Promise<AssistantArtifact> {
	const board = normalizeKanbanOverlay(context.kanban);

	// 5a. Model-assisted edit when API key is available
	if (bindings?.ANTHROPIC_API_KEY) {
		try {
			const boardJson = JSON.stringify(board, null, 2);
			const completion = await createAnthropicMessage(bindings, {
				system: [
					'You are AI Canvas, editing a selected Kanban board.',
					'Return ONLY a JSON object — no markdown, no prose, no code fences.',
				].join('\n'),
				messages: [
					{
						role: 'user',
						content: buildKanbanEditPrompt(message, boardJson),
					},
				],
				maxTokens: 4000,
			});

			const responseText = completion.text.trim();
			// Strip optional markdown code fences if the model included them despite instructions
			const jsonText = responseText
				.replace(/^```(?:json)?\s*/i, '')
				.replace(/\s*```$/, '')
				.trim();

			let parsedBoard: KanbanOverlayCustomData | null = null;
			try {
				const raw = JSON.parse(jsonText) as unknown;
				parsedBoard = normalizeKanbanOverlay(raw as Parameters<typeof normalizeKanbanOverlay>[0]);
			} catch {
				// JSON parse failed — fall through to deterministic fallback
			}

			if (parsedBoard) {
				const patch: AssistantKanbanPatchArtifact = {
					kind: 'kanban_patch',
					targetId: context.id,
					summary: 'Updates the selected Kanban board to satisfy the edit request.',
					operations: [],
					base: board,
					next: parsedBoard,
				};
				return {
					type: 'kanban-patch',
					content: JSON.stringify(patch, null, 2),
				};
			}
		} catch {
			// Fall back to the deterministic heuristics below
		}
	}

	// 5b. Deterministic fallback heuristics

	// Detect "remove card" intent
	const removeCardId = detectRemoveCardIntent(board, message);
	if (removeCardId) {
		const nextBoard = normalizeKanbanOverlay({
			...board,
			columns: board.columns.map((column) => ({
				...column,
				cards: column.cards.filter((card) => card.id !== removeCardId),
			})),
		});
		const removedCard = board.columns
			.flatMap((c) => c.cards)
			.find((card) => card.id === removeCardId);
		const patch: AssistantKanbanPatchArtifact = {
			kind: 'kanban_patch',
			targetId: context.id,
			summary: `Removes card "${removedCard?.title ?? removeCardId}" from the board.`,
			operations: [{ type: 'remove_card', card_id: removeCardId }],
			base: board,
			next: nextBoard,
		};
		return {
			type: 'kanban-patch',
			content: JSON.stringify(patch, null, 2),
		};
	}

	// Detect "move card to column" intent
	const moveIntent = detectMoveCardIntent(board, message);
	if (moveIntent) {
		const { cardId, targetColumnId } = moveIntent;

		// Build updated board: remove card from source, add to target
		let movedCard: (typeof board.columns)[0]['cards'][0] | undefined;
		const colsWithoutCard = board.columns.map((column) => {
			const idx = column.cards.findIndex((c) => c.id === cardId);
			if (idx === -1) return column;
			movedCard = column.cards[idx];
			return { ...column, cards: column.cards.filter((c) => c.id !== cardId) };
		});

		if (movedCard) {
			const nextBoard = normalizeKanbanOverlay({
				...board,
				columns: colsWithoutCard.map((column) =>
					column.id === targetColumnId
						? { ...column, cards: [...column.cards, movedCard!] }
						: column,
				),
			});
			const targetColumn = board.columns.find((c) => c.id === targetColumnId);
			const patch: AssistantKanbanPatchArtifact = {
				kind: 'kanban_patch',
				targetId: context.id,
				summary: `Moves card "${movedCard.title}" to "${targetColumn?.title ?? targetColumnId}".`,
				operations: [
					{
						type: 'move_card',
						card_id: cardId,
						to_column_id: targetColumnId,
					},
				],
				base: board,
				next: nextBoard,
			};
			return {
				type: 'kanban-patch',
				content: JSON.stringify(patch, null, 2),
			};
		}
	}

	// Default: add a new card to the best-matching column
	const targetColumn = findKanbanTargetColumn(board, message);
	if (!targetColumn) {
		return {
			type: 'kanban-patch',
			content: JSON.stringify(
				{
					kind: 'kanban_patch',
					targetId: context.id,
					summary: 'No editable columns were available on the selected board.',
					operations: [],
					base: board,
					next: board,
				} satisfies AssistantKanbanPatchArtifact,
				null,
				2,
			),
		};
	}

	const nextBoard = normalizeKanbanOverlay({
		...board,
		columns: board.columns.map((column) =>
			column.id === targetColumn.id
				? {
						...column,
						cards: [
							...column.cards,
							{
								id: crypto.randomUUID(),
								title: truncateLabel(message, 48),
								description: `Generated from assistant request: ${truncateLabel(message, 120)}`,
								priority: 'medium',
								labels: ['AI'],
								checklist: [],
							},
						],
					}
				: column,
		),
	});
	const patch: AssistantKanbanPatchArtifact = {
		kind: 'kanban_patch',
		targetId: context.id,
		summary: `Adds a new assistant task to "${targetColumn.title}".`,
		operations: [
			{
				type: 'add_card',
				column_id: targetColumn.id,
				title: truncateLabel(message, 48),
				description: `Generated from assistant request: ${truncateLabel(message, 120)}`,
				priority: 'medium',
				labels: ['AI'],
			},
		],
		base: board,
		next: nextBoard,
	};

	return {
		type: 'kanban-patch',
		content: JSON.stringify(patch, null, 2),
	};
}

async function buildSelectedEditDraft(
	input: AssistantServiceInput,
	generationMode: GenerationMode,
): Promise<AssistantDraft | null> {
	if (!isEditableSelectionRequest(input.message) || isCreateNewArtifactIntent(input.message)) {
		return null;
	}

	const editableContexts = getSelectedEditableContexts(input);
	if (editableContexts.length === 0) {
		return null;
	}

	if (editableContexts.length > 1) {
		const labels = editableContexts
			.map((context) => context.label ?? context.id)
			.slice(0, 4)
			.join(', ');
		return {
			content: [
				'I found more than one editable selected item, so I did not apply a patch automatically.',
				'',
				`Selected editable items: ${labels}.`,
				'Please narrow the selection or name the specific board or note you want me to change.',
			].join('\n'),
		};
	}

	const artifacts: AssistantArtifact[] = [];
	for (const context of editableContexts) {
		if (context.kind === 'markdown' && generationMode === 'chat') {
			artifacts.push(await createMarkdownPatchArtifact(context, input.message, input.bindings));
			continue;
		}

		if (context.kind === 'kanban' && (generationMode === 'chat' || generationMode === 'kanban')) {
			artifacts.push(await createKanbanPatchArtifact(context, input.message, input.bindings));
		}
	}

	if (artifacts.length === 0) {
		return null;
	}

	const artifactLabels = artifacts.map((artifact) =>
		artifact.type === 'markdown-patch' ? 'markdown patch' : 'kanban patch',
	);

	return {
		content: [
			'Prepared reversible selection edits.',
			'',
			`Request: ${sentenceCase(input.message)}`,
			'',
			`Ready to apply: ${artifactLabels.join(', ')}.`,
			'Use the patch cards below to apply, undo, or reapply each change.',
		].join('\n'),
		artifacts,
	};
}

function truncateTitle(text: string): string {
	return sentenceCase(text).slice(0, 32) || 'Prototype';
}

function extractPrototypeSubject(message: string): string {
	const match = message.match(/\b(?:for|about|around|targeting)\s+(.+)$/i);
	const subject = (match?.[1] ?? message)
		.replace(
			/\b(create|build|make|design|prototype|website|landing page|landing-page|page|dashboard|app)\b/gi,
			' ',
		)
		.replace(/[^\w\s-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return subject || 'AI Product';
}

function toTitleWords(text: string): string {
	return text
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

function extractPromptKeywords(text: string): string[] {
	const stopwords = new Set([
		'a',
		'an',
		'and',
		'app',
		'build',
		'create',
		'design',
		'for',
		'from',
		'in',
		'landing',
		'page',
		'prototype',
		'site',
		'that',
		'the',
		'this',
		'website',
		'with',
	]);

	return Array.from(
		new Set(
			text
				.toLowerCase()
				.split(/[^a-z0-9]+/)
				.filter((token) => token.length > 2 && !stopwords.has(token)),
		),
	).slice(0, 6);
}

function expectsFunctionalPrototype(message: string): boolean {
	const normalized = message.toLowerCase();
	if (/(landing page|landing-page|website|homepage|marketing site)/.test(normalized)) {
		return false;
	}

	return /(calculator|todo|timer|tracker|converter|quiz|editor|generator|planner|tool|utility|app)/.test(
		normalized,
	);
}

function pickPrototypePalette(seed: string) {
	const palettes = [
		{ accent: '#0f766e', background: 'linear-gradient(145deg, #ecfeff, #ccfbf1 42%, #dcfce7)' },
		{ accent: '#2563eb', background: 'linear-gradient(145deg, #eff6ff, #dbeafe 42%, #e0f2fe)' },
		{ accent: '#c2410c', background: 'linear-gradient(145deg, #fff7ed, #ffedd5 42%, #fef3c7)' },
		{ accent: '#be185d', background: 'linear-gradient(145deg, #fdf2f8, #fce7f3 42%, #fae8ff)' },
	];
	const code = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);
	return palettes[code % palettes.length]!;
}

function createPrototypeFile(
	code: string,
	options?: Partial<PrototypeOverlayCustomData['files'][string]>,
) {
	return {
		code,
		...(options ?? {}),
	};
}

function buildCalculatorPrototype(
	subjectTitle: string,
	palette: { accent: string; background: string },
	template: PrototypeOverlayCustomData['template'],
): PrototypeOverlayCustomData {
	const title = `${subjectTitle} App`;
	if (template === 'vanilla') {
		const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="prototype-shell">
      <section class="calculator-card">
        <header class="calculator-header">
          <div>
            <div class="eyebrow">Interactive prototype</div>
            <h1>${title}</h1>
            <p>Use the live keypad, test operations, and validate the behavior directly on the canvas.</p>
          </div>
          <div class="status-pill">Ready</div>
        </header>
        <section class="calculator-grid">
          <div class="display-panel">
            <div class="display-label">Expression</div>
            <div id="display" class="display-value">12+8</div>
          </div>
          <div id="keypad" class="keypad-panel"></div>
          <aside class="history-panel">
            <div class="panel-title">Recent calculations</div>
            <div id="history" class="app-list"></div>
          </aside>
        </section>
      </section>
    </main>
    <script type="module" src="./index.js"></script>
  </body>
</html>`;
		const js = `const rows = [
  [
    { label: 'C', kind: 'ghost', action: 'clear' },
    { label: '⌫', kind: 'ghost', action: 'backspace' },
    { label: '%', kind: 'ghost', action: 'append' },
    { label: '÷', kind: 'accent', action: 'append', value: '/' },
  ],
  [
    { label: '7', action: 'append' },
    { label: '8', action: 'append' },
    { label: '9', action: 'append' },
    { label: '×', kind: 'accent', action: 'append', value: '*' },
  ],
  [
    { label: '4', action: 'append' },
    { label: '5', action: 'append' },
    { label: '6', action: 'append' },
    { label: '-', kind: 'accent', action: 'append' },
  ],
  [
    { label: '1', action: 'append' },
    { label: '2', action: 'append' },
    { label: '3', action: 'append' },
    { label: '+', kind: 'accent', action: 'append' },
  ],
  [
    { label: '0', action: 'append', kind: 'wide' },
    { label: '.', action: 'append' },
    { label: '=', kind: 'accent', action: 'evaluate' },
  ],
];

const display = document.getElementById('display');
const keypad = document.getElementById('keypad');
const history = document.getElementById('history');

let expression = '12+8';
let historyItems = ['12 + 8 = 20', '9 × 7 = 63'];

function evaluateExpression(value) {
  const sanitized = value.replace(/[^0-9+\\-*/.()]/g, '');
  if (!sanitized.trim()) return '0';

  try {
    const result = Function(\`"use strict"; return (\${sanitized})\`)();
    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      return 'Error';
    }
    return String(Number(result.toFixed(6)));
  } catch {
    return 'Error';
  }
}

function renderHistory() {
  history.innerHTML = '';
  historyItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.textContent = item;
    history.appendChild(row);
  });
}

function renderDisplay() {
  display.textContent = expression;
}

function handleKey(key) {
  if (key.action === 'append') {
    const nextValue = key.value ?? key.label;
    expression = expression === '0' || expression === 'Error' ? nextValue : \`\${expression}\${nextValue}\`;
  } else if (key.action === 'clear') {
    expression = '0';
  } else if (key.action === 'backspace') {
    expression = expression === 'Error' ? '0' : expression.slice(0, -1) || '0';
  } else if (key.action === 'evaluate') {
    const result = evaluateExpression(expression);
    if (result !== 'Error') {
      historyItems = [\`\${expression.replace(/\\*/g, '×').replace(/\\//g, '÷')} = \${result}\`, ...historyItems].slice(0, 6);
      renderHistory();
    }
    expression = result;
  }

  renderDisplay();
}

rows.forEach((row) => {
  const rowEl = document.createElement('div');
  rowEl.className = 'keypad-row';
  row.forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = key.label;
    button.className = ['calc-button', key.kind ? \`calc-button--\${key.kind}\` : ''].filter(Boolean).join(' ');
    button.addEventListener('click', () => handleKey(key));
    rowEl.appendChild(button);
  });
  keypad.appendChild(rowEl);
});

renderDisplay();
renderHistory();
`;
		const css = `* {
  box-sizing: border-box;
}

:root {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}

html, body {
  min-height: 100%;
}

body {
  margin: 0;
  background: ${palette.background};
}

button {
  border: 0;
  cursor: pointer;
}

.prototype-shell {
  min-height: 100vh;
  padding: 16px;
  display: grid;
  place-items: center;
}

.calculator-card {
  width: min(100%, 920px);
  border-radius: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.92);
  padding: 22px;
  box-shadow: 0 28px 84px rgba(15, 23, 42, 0.14);
}

.calculator-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow, .display-label, .panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

h1 {
  margin: 10px 0 0;
  font-size: 40px;
  line-height: 0.96;
}

p {
  margin: 12px 0 0;
  max-width: 54ch;
  color: #475569;
  line-height: 1.55;
}

.status-pill {
  border-radius: 999px;
  background: color-mix(in srgb, ${palette.accent} 14%, white);
  color: ${palette.accent};
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.calculator-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  margin-top: 22px;
}

.display-panel, .keypad-panel, .history-panel {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.96);
}

.display-panel {
  grid-column: 1 / 2;
  padding: 18px;
  background: #0f172a;
}

.display-label {
  color: rgba(255, 255, 255, 0.56);
}

.display-value {
  margin-top: 12px;
  color: white;
  font-size: clamp(28px, 6vw, 54px);
  font-weight: 800;
  text-align: right;
  min-height: 64px;
  word-break: break-all;
}

.keypad-panel {
  grid-column: 1 / 2;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.keypad-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.calc-button {
  min-height: 64px;
  border-radius: 18px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 22px;
  font-weight: 700;
}

.calc-button--accent {
  background: ${palette.accent};
  color: white;
}

.calc-button--ghost {
  background: #e2e8f0;
  color: #334155;
}

.calc-button--wide {
  grid-column: span 2;
}

.history-panel {
  padding: 18px;
}

.history-row {
  margin-top: 12px;
  border-radius: 16px;
  background: #f8fafc;
  padding: 12px 14px;
  color: #334155;
}

@media (max-width: 860px) {
  .calculator-grid {
    grid-template-columns: 1fr;
  }
}`;
		return normalizePrototypeOverlay({
			title,
			template: 'vanilla',
			activeFile: '/index.js',
			files: {
				'/index.html': createPrototypeFile(html, { hidden: true }),
				'/index.js': createPrototypeFile(js),
				'/styles.css': createPrototypeFile(css),
			},
			preview: {
				eyebrow: 'Interactive prototype',
				title,
				description:
					'A functional calculator with live arithmetic controls and calculation history.',
				accent: palette.accent,
				background: palette.background,
				badges: ['Calculator', 'Interactive', 'Vanilla'],
				metrics: [
					{ label: 'Mode', value: 'Live' },
					{ label: 'Keys', value: '19' },
					{ label: 'History', value: '6' },
				],
			},
		});
	}
	const buttonComponent = `export function CalculatorButton({ label, variant = 'default', onClick }) {
  return (
    <button type="button" className={\`calc-button calc-button--\${variant}\`} onClick={onClick}>
      {label}
    </button>
  );
}
`;
	const calculatorLogic = `export function evaluateExpression(expression) {
  const sanitized = expression.replace(/[^0-9+\\-*/.()]/g, '');

  if (!sanitized.trim()) {
    return '0';
  }

  try {
    const result = Function(\`"use strict"; return (\${sanitized})\`)();
    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      return 'Error';
    }
    return String(Number(result.toFixed(6)));
  } catch {
    return 'Error';
  }
}
`;
	const appCode = `import { useState } from 'react';
import './styles.css';
import { CalculatorButton } from './components/CalculatorButton';
import { evaluateExpression } from './lib/calc';

const rows = [
  [
    { label: 'C', variant: 'ghost', action: 'clear' },
    { label: '⌫', variant: 'ghost', action: 'backspace' },
    { label: '%', variant: 'ghost', action: 'append' },
    { label: '÷', variant: 'accent', action: 'append', value: '/' },
  ],
  [
    { label: '7', action: 'append' },
    { label: '8', action: 'append' },
    { label: '9', action: 'append' },
    { label: '×', variant: 'accent', action: 'append', value: '*' },
  ],
  [
    { label: '4', action: 'append' },
    { label: '5', action: 'append' },
    { label: '6', action: 'append' },
    { label: '-', variant: 'accent', action: 'append' },
  ],
  [
    { label: '1', action: 'append' },
    { label: '2', action: 'append' },
    { label: '3', action: 'append' },
    { label: '+', variant: 'accent', action: 'append' },
  ],
  [
    { label: '0', action: 'append', variant: 'wide' },
    { label: '.', action: 'append' },
    { label: '=', variant: 'accent', action: 'evaluate' },
  ],
];

export default function App() {
  const [expression, setExpression] = useState('12+8');
  const [history, setHistory] = useState(['12 + 8 = 20', '9 × 7 = 63']);

  const appendValue = (value) => {
    setExpression((current) => (current === '0' || current === 'Error' ? value : \`\${current}\${value}\`));
  };

  const handleAction = (key) => {
    if (key.action === 'append') {
      appendValue(key.value ?? key.label);
      return;
    }

    if (key.action === 'clear') {
      setExpression('0');
      return;
    }

    if (key.action === 'backspace') {
      setExpression((current) => {
        const next = current === 'Error' ? '0' : current.slice(0, -1);
        return next.length > 0 ? next : '0';
      });
      return;
    }

    if (key.action === 'evaluate') {
      const result = evaluateExpression(expression);
      if (result !== 'Error') {
        setHistory((current) => [\`\${expression.replace(/\\*/g, '×').replace(/\\//g, '÷')} = \${result}\`, ...current].slice(0, 6));
      }
      setExpression(result);
    }
  };

  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="calculator-frame">
        <div className="calculator-card">
          <header className="calculator-header">
            <div>
              <span className="eyebrow">Interactive prototype</span>
              <h1>${title}</h1>
              <p>Use the live keypad, test operations, and validate the functional behavior directly on the canvas.</p>
            </div>
            <div className="status-pill">Ready</div>
          </header>

          <section className="calculator-grid">
            <div className="display-panel">
              <div className="display-label">Expression</div>
              <div className="display-value">{expression}</div>
            </div>

            <div className="keypad-panel">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="keypad-row">
                  {row.map((key) => (
                    <CalculatorButton
                      key={key.label}
                      label={key.label}
                      variant={key.variant}
                      onClick={() => handleAction(key)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <aside className="history-panel">
              <div className="panel-title">Recent calculations</div>
              {history.map((item) => (
                <div key={item} className="history-row">{item}</div>
              ))}
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
`;
	const css = `* {
  box-sizing: border-box;
}

:root {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  background: #f8fafc;
}

button {
  border: 0;
  cursor: pointer;
}

.prototype-shell {
  min-height: 100%;
  padding: 16px;
  background: var(--page-bg);
}

.calculator-frame {
  min-height: calc(100vh - 32px);
  display: grid;
  place-items: center;
}

.calculator-card {
  width: min(100%, 980px);
  border-radius: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.9);
  padding: 22px;
  box-shadow: 0 28px 84px rgba(15, 23, 42, 0.14);
}

.calculator-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow,
.display-label,
.panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

h1 {
  margin: 10px 0 0;
  font-size: 40px;
  line-height: 0.96;
}

p {
  margin: 12px 0 0;
  max-width: 54ch;
  color: #475569;
  line-height: 1.55;
}

.status-pill {
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent);
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.calculator-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  margin-top: 22px;
}

.display-panel,
.keypad-panel,
.history-panel {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.96);
}

.display-panel {
  grid-column: 1 / 2;
  padding: 18px;
  background: #0f172a;
}

.display-label {
  color: rgba(255, 255, 255, 0.56);
}

.display-value {
  margin-top: 12px;
  color: white;
  font-size: clamp(28px, 6vw, 54px);
  font-weight: 800;
  text-align: right;
  min-height: 64px;
  word-break: break-all;
}

.keypad-panel {
  grid-column: 1 / 2;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.keypad-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.calc-button {
  min-height: 64px;
  border-radius: 18px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 22px;
  font-weight: 700;
  transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
}

.calc-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(15, 23, 42, 0.1);
}

.calc-button--accent {
  background: var(--accent);
  color: white;
}

.calc-button--ghost {
  background: #e2e8f0;
  color: #334155;
}

.calc-button--wide {
  grid-column: span 2;
}

.history-panel {
  padding: 18px;
}

.history-row {
  margin-top: 12px;
  border-radius: 16px;
  background: #f8fafc;
  padding: 12px 14px;
  color: #334155;
}

@media (max-width: 860px) {
  body {
    overflow: auto;
  }

  .calculator-grid {
    grid-template-columns: 1fr;
  }
}
`;
	const base = normalizePrototypeOverlay({
		title,
		template: 'react',
	});

	return normalizePrototypeOverlay({
		...base,
		title,
		activeFile: '/App.jsx',
		files: {
			...base.files,
			'/App.jsx': createPrototypeFile(appCode),
			'/index.jsx': createPrototypeFile(base.files['/index.jsx']?.code ?? '', { hidden: true }),
			'/styles.css': createPrototypeFile(css),
			'/components/CalculatorButton.jsx': createPrototypeFile(buttonComponent),
			'/lib/calc.js': createPrototypeFile(calculatorLogic),
		},
		preview: {
			eyebrow: 'Interactive prototype',
			title,
			description: 'A functional calculator with live arithmetic controls and calculation history.',
			accent: palette.accent,
			background: palette.background,
			badges: ['Calculator', 'Interactive', 'React'],
			metrics: [
				{ label: 'Mode', value: 'Live' },
				{ label: 'Keys', value: '19' },
				{ label: 'History', value: '6' },
			],
		},
	});
}

function buildPromptDrivenPrototype(input: AssistantServiceInput): PrototypeOverlayCustomData {
	const subject = extractPrototypeSubject(input.message);
	const subjectTitle = toTitleWords(subject).slice(0, 36);
	const brand = subjectTitle.split(/\s+/).slice(0, 2).join(' ') || 'Canvas Forge';
	const keywords = extractPromptKeywords(subject);
	const palette = pickPrototypePalette(subject);
	const template = inferPrototypeTemplate(input);
	const variant = /calculator/i.test(input.message)
		? 'calculator'
		: /dashboard|admin|analytics|workspace|portal|command center/i.test(input.message)
			? 'dashboard'
			: expectsFunctionalPrototype(input.message)
				? 'app'
				: 'landing';

	if (variant === 'calculator') {
		return buildCalculatorPrototype(subjectTitle, palette, template);
	}
	const headline =
		variant === 'dashboard'
			? `Operate ${subjectTitle.toLowerCase()} from one live workspace.`
			: variant === 'app'
				? `Use ${subjectTitle.toLowerCase()} through a live working interface.`
				: `Launch ${subjectTitle.toLowerCase()} with a sharper story and faster conversion.`;
	const summary =
		variant === 'dashboard'
			? `Track the main signals for ${subject.toLowerCase()}, coordinate teams, and move from insight to action in one interface.`
			: variant === 'app'
				? `Work with ${subject.toLowerCase()} directly in the prototype, validate behavior, and refine the interaction model without leaving the canvas.`
				: `Present the value of ${subject.toLowerCase()} with clear positioning, focused benefits, and a decisive call to action.`;
	const badges =
		keywords.length > 0 ? keywords.slice(0, 4).map(toTitleWords) : ['Strategy', 'Design', 'Launch'];
	const features = (
		keywords.length > 0 ? keywords : ['workflow', 'conversion', 'automation']
	).slice(0, 3);
	const metrics =
		variant === 'dashboard'
			? [
					{ label: 'Active', value: '142' },
					{ label: 'At Risk', value: '09' },
					{ label: 'Win Rate', value: '38%' },
				]
			: [
					{ label: 'Visitors', value: '24k' },
					{ label: 'Conversion', value: '7.4%' },
					{ label: 'Pipeline', value: '$186k' },
				];
	const jsx =
		variant === 'dashboard'
			? `import './styles.css';

const metrics = ${JSON.stringify(metrics, null, 2)};
const priorities = ${JSON.stringify(
					features.map((feature, index) => `${toTitleWords(feature)} stream ${index + 1}`),
					null,
					2,
				)};
const updates = ${JSON.stringify(
					[
						`${brand} approvals waiting on design review`,
						`Critical ${features[0] ?? 'workflow'} automation needs refinement`,
						`Leadership update scheduled for tomorrow morning`,
					],
					null,
					2,
				)};

export default function App() {
  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame dashboard-frame">
        <aside className="sidebar">
          <div className="brand-lockup">
            <div className="brand-mark">${brand
							.split(/\s+/)
							.map((word) => word[0])
							.join('')
							.slice(0, 2)}</div>
            <div>
              <div className="eyebrow">Live operations</div>
              <div className="brand-name">${brand}</div>
            </div>
          </div>
          <div className="sidebar-copy">${badges.join(' · ')}</div>
          <div className="sidebar-panel">
            <span>Focus areas</span>
            {priorities.map((item) => (
              <div key={item} className="sidebar-chip">{item}</div>
            ))}
          </div>
        </aside>

        <section className="content">
          <header className="hero-card">
            <div>
              <span className="eyebrow">${subjectTitle}</span>
              <h1>${headline}</h1>
              <p>${summary}</p>
            </div>
            <div className="hero-badge">Control Room</div>
          </header>

          <section className="metric-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>

          <section className="panel-grid">
            <article className="panel">
              <div className="panel-title">Priority queue</div>
              <div className="stack-list">
                {priorities.map((item, index) => (
                  <div key={item} className="stack-row">
                    <span className="stack-index">0{index + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel panel-accent">
              <div className="panel-title panel-title-inverse">Executive updates</div>
              <div className="update-list">
                {updates.map((item) => (
                  <div key={item} className="update-row">{item}</div>
                ))}
              </div>
            </article>
          </section>
        </section>
      </section>
    </main>
  );
}`
			: variant === 'app'
				? `import { useState } from 'react';
import './styles.css';

const starterItems = ${JSON.stringify(
						features.map((feature, index) => ({
							id: `item-\${index + 1}`,
							label: `${toTitleWords(feature)} task`,
						})),
						null,
						2,
					)};

export default function App() {
  const [items, setItems] = useState(starterItems);
  const [draft, setDraft] = useState('');

  const addItem = () => {
    if (!draft.trim()) return;
    setItems((current) => [...current, { id: crypto.randomUUID(), label: draft.trim() }]);
    setDraft('');
  };

  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame landing-frame">
        <header className="nav-bar">
          <div className="brand-lockup">
            <div className="brand-mark">${brand
							.split(/\s+/)
							.map((word) => word[0])
							.join('')
							.slice(0, 2)}</div>
            <div>
              <div className="eyebrow">Interactive app</div>
              <div className="brand-name">${brand}</div>
            </div>
          </div>
          <div className="hero-badge">Prototype</div>
        </header>

        <section className="hero-card hero-card--landing">
          <div>
            <span className="eyebrow">${subjectTitle}</span>
            <h1>${headline}</h1>
            <p>${summary}</p>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-title">Live editor</div>
            <div className="app-editor">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add an item" />
              <button type="button" className="primary-button" onClick={addItem}>Add</button>
            </div>
            <div className="app-list">
              {items.map((item) => (
                <div key={item.id} className="proof-row">{item.label}</div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}`
				: `import './styles.css';

const features = ${JSON.stringify(
						features.map((feature) => ({
							title: toTitleWords(feature),
							copy: `Built to improve ${feature} outcomes with faster execution and cleaner collaboration.`,
						})),
						null,
						2,
					)};
const proofPoints = ${JSON.stringify(
						[
							`Teams adopt ${brand} in under 14 days`,
							`${brand} shortens planning cycles by 32%`,
							`Customers use ${subject.toLowerCase()} workflows daily`,
						],
						null,
						2,
					)};

export default function App() {
  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame landing-frame">
        <header className="nav-bar">
          <div className="brand-lockup">
            <div className="brand-mark">${brand
							.split(/\s+/)
							.map((word) => word[0])
							.join('')
							.slice(0, 2)}</div>
            <div>
              <div className="eyebrow">${subjectTitle}</div>
              <div className="brand-name">${brand}</div>
            </div>
          </div>
          <button type="button" className="primary-button">Book Demo</button>
        </header>

        <section className="hero-card hero-card--landing">
          <div>
            <span className="eyebrow">Conversion-ready website</span>
            <h1>${headline}</h1>
            <p>${summary}</p>
            <div className="hero-actions">
              <button type="button" className="primary-button">Start Free</button>
              <button type="button" className="secondary-button">See the tour</button>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-title">Why teams choose ${brand}</div>
            {proofPoints.map((item) => (
              <div key={item} className="proof-row">{item}</div>
            ))}
          </div>
        </section>

        <section className="feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card">
              <span className="feature-kicker">${subjectTitle}</span>
              <h2>{feature.title}</h2>
              <p>{feature.copy}</p>
            </article>
          ))}
        </section>

        <section className="cta-band">
          <div>
            <span className="eyebrow">Ready to launch</span>
            <h2>Turn ${subject.toLowerCase()} into a clearer growth story.</h2>
          </div>
          <button type="button" className="primary-button">Create Your Site</button>
        </section>
      </section>
    </main>
  );
}`;
	const css = `* {
  box-sizing: border-box;
}

:root {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  background: #f8fafc;
}

button {
  border: 0;
  cursor: pointer;
}

.prototype-shell {
  min-height: 100%;
  padding: 14px;
  background: var(--page-bg);
}

.app-frame {
  width: 100%;
  min-height: calc(100vh - 28px);
  border-radius: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.landing-frame {
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: 18px;
  padding: 18px;
}

.dashboard-frame {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
}

.nav-bar,
.hero-card,
.metric-grid,
.panel-grid,
.feature-grid,
.cta-band {
  position: relative;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #0f172a;
  color: white;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.eyebrow,
.feature-kicker,
.panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

.brand-name {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
}

.primary-button,
.secondary-button,
.hero-badge,
.sidebar-chip {
  border-radius: 999px;
  padding: 12px 16px;
  font-weight: 700;
}

.primary-button {
  background: var(--accent);
  color: white;
}

.secondary-button {
  background: white;
  color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.hero-card {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 18px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.72));
  padding: 22px;
}

.hero-card--landing {
  align-items: stretch;
}

h1,
h2 {
  margin: 10px 0 0;
  line-height: 0.98;
}

h1 {
  max-width: 12ch;
  font-size: 42px;
}

h2 {
  font-size: 24px;
}

p {
  margin: 12px 0 0;
  color: #475569;
  line-height: 1.55;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.hero-panel,
.feature-card,
.metric-card,
.panel,
.cta-band,
.sidebar-panel {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.9);
  padding: 18px;
}

.hero-panel-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
}

.proof-row,
.stack-row,
.update-row {
  padding: 12px 14px;
  border-radius: 16px;
  background: #f8fafc;
}

.proof-row + .proof-row,
.update-row + .update-row {
  margin-top: 10px;
}

.app-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.app-editor input {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
}

.app-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.feature-grid,
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.cta-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  background: rgba(248, 250, 252, 0.84);
  border-right: 1px solid rgba(148, 163, 184, 0.14);
}

.sidebar-copy {
  font-size: 13px;
  line-height: 1.5;
  color: #475569;
}

.sidebar-panel {
  display: grid;
  gap: 10px;
}

.sidebar-panel span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #64748b;
}

.sidebar-chip {
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: var(--accent);
  text-align: left;
}

.content {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  padding: 18px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  height: fit-content;
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent);
}

.metric-card span,
.panel-title {
  color: #64748b;
}

.metric-card strong {
  display: block;
  margin-top: 10px;
  font-size: 28px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 14px;
}

.panel-accent {
  background: var(--accent);
  color: white;
}

.panel-title-inverse {
  color: rgba(255, 255, 255, 0.84);
}

.stack-list,
.update-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.stack-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stack-index {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: white;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 860px) {
  body {
    overflow: auto;
  }

  .dashboard-frame,
  .hero-card,
  .feature-grid,
  .metric-grid,
  .panel-grid,
  .cta-band {
    grid-template-columns: 1fr;
  }

  .dashboard-frame {
    display: block;
  }
}
`;
	const base = normalizePrototypeOverlay({
		title:
			variant === 'dashboard'
				? `${brand} Dashboard`
				: variant === 'app'
					? `${brand} App`
					: `${brand} Website`,
		template,
	});

	return normalizePrototypeOverlay({
		...base,
		title:
			variant === 'dashboard'
				? `${brand} Dashboard`
				: variant === 'app'
					? `${brand} App`
					: `${brand} Website`,
		dependencies: {},
		activeFile: '/App.jsx',
		files: {
			...base.files,
			'/App.jsx': createPrototypeFile(jsx),
			'/index.jsx': createPrototypeFile(base.files['/index.jsx']?.code ?? '', { hidden: true }),
			'/styles.css': createPrototypeFile(css),
		},
		preview: {
			eyebrow:
				variant === 'dashboard'
					? 'Live workspace'
					: variant === 'app'
						? 'Interactive app'
						: 'Prototype website',
			title:
				variant === 'dashboard'
					? `${brand} Dashboard`
					: variant === 'app'
						? `${brand} App`
						: `${brand} Website`,
			description: summary,
			accent: palette.accent,
			background: palette.background,
			badges,
			metrics,
		},
	});
}

function serializePrototypeArtifact(prototype: PrototypeOverlayCustomData): string {
	return JSON.stringify(
		{
			title: prototype.title,
			template: prototype.template,
			activeFile: prototype.activeFile,
			dependencies: prototype.dependencies,
			preview: prototype.preview,
			files: prototype.files,
			showEditor: prototype.showEditor,
			showPreview: prototype.showPreview,
		},
		null,
		2,
	);
}

function buildPrototypeFallback(input: AssistantServiceInput): PrototypeOverlayCustomData {
	return buildPromptDrivenPrototype(input);
}

function parsePrototypeArtifactContent(value: string): PrototypeOverlayCustomData | null {
	try {
		const parsed = JSON.parse(value) as Record<string, unknown> & {
			prototype?: PrototypeOverlayCustomData;
		};
		return normalizePrototypeOverlay(
			(typeof parsed.prototype === 'object' && parsed.prototype !== null
				? parsed.prototype
				: parsed) as PrototypeOverlayCustomData | Record<string, unknown>,
		);
	} catch {
		return null;
	}
}

function isStarterPrototypeOutput(prototype: PrototypeOverlayCustomData): boolean {
	const defaultPrototype = normalizePrototypeOverlay({ template: 'react', title: 'Prototype' });
	const appCode = normalizeSource(prototype.files['/App.jsx']?.code);
	const defaultAppCode = normalizeSource(defaultPrototype.files['/App.jsx']?.code);
	const stylesCode = normalizeSource(prototype.files['/styles.css']?.code);
	const defaultStylesCode = normalizeSource(defaultPrototype.files['/styles.css']?.code);

	return (
		appCode === defaultAppCode ||
		stylesCode === defaultStylesCode ||
		appCode.includes('PulseBoard') ||
		appCode.includes('launch: {') ||
		appCode.includes('pipeline: {')
	);
}

function isFunctionalPrototypeOutput(
	prototype: PrototypeOverlayCustomData,
	message: string,
): boolean {
	if (!expectsFunctionalPrototype(message)) {
		return true;
	}

	const appCode = normalizeSource(prototype.files['/App.jsx']?.code);
	const hasState = appCode.includes('useState');
	const hasInteraction = appCode.includes('onClick') || appCode.includes('onSubmit');
	const looksLikeMarketing =
		appCode.includes('Start Free') ||
		appCode.includes('Book Demo') ||
		appCode.includes('See the tour') ||
		appCode.includes('Conversion-ready website');

	if (/calculator/i.test(message)) {
		const hasCalculatorBehavior =
			appCode.includes('evaluateExpression') ||
			appCode.includes('CalculatorButton') ||
			appCode.includes("label: '='") ||
			appCode.includes("label: '÷'");
		return hasState && hasInteraction && hasCalculatorBehavior && !looksLikeMarketing;
	}

	return hasState && hasInteraction && !looksLikeMarketing;
}

function buildMermaidDraft(
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

function buildMermaidDraftFromHistory(input: AssistantServiceInput): AssistantDraft | null {
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

function buildD2Draft(
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

function buildD2DraftFromHistory(input: AssistantServiceInput): AssistantDraft | null {
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

function buildKanbanDraft(input: AssistantServiceInput): AssistantDraft {
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

function buildPrototypeDraft(input: AssistantServiceInput): AssistantDraft {
	const prototype = buildPrototypeFallback(input);
	const serialized = serializePrototypeArtifact(prototype);

	return {
		content: [
			'Prepared prototype files for the canvas.',
			'',
			`Request: ${sentenceCase(input.message)}`,
			'',
			'The output includes a full multi-file prototype payload that can be inserted onto the canvas or applied to a selected prototype.',
		].join('\n'),
		artifacts: [{ type: 'prototype-files', content: serialized }],
	};
}

function buildChatDraft(input: AssistantServiceInput): AssistantDraft {
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

function buildDraft(input: AssistantServiceInput): AssistantDraft {
	switch (resolveGenerationMode(input)) {
		case 'mermaid':
			return (
				buildMermaidDraftFromHistory(input) ?? buildMermaidDraft(input.message, input.contextMode)
			);
		case 'd2':
			return buildD2DraftFromHistory(input) ?? buildD2Draft(input.message, input.contextMode);
		case 'kanban':
			return buildKanbanDraft(input);
		case 'image':
		case 'sketch':
			return {
				content: [
					`Prepared a ${resolveGenerationMode(input) === 'sketch' ? 'sketch' : 'multimodal image'} run.`,
					'',
					`Request: ${sentenceCase(input.message)}`,
					'',
					'The executor can attach a generated asset that stays in chat until you choose to insert it.',
				].join('\n'),
			};
		case 'svg': {
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
		case 'prototype':
			return buildPrototypeDraft(input);
		case 'chat':
		default:
			return buildChatDraft(input);
	}
}

async function buildAnthropicDraft(input: AssistantServiceInput): Promise<AssistantDraft | null> {
	if (!input.bindings?.ANTHROPIC_API_KEY) {
		return null;
	}

	const generationMode = resolveGenerationMode(input);
	const contextSnapshotSummary =
		input.contextMode === 'none' ? null : summarizeAssistantContextSnapshot(input.contextSnapshot);
	const systemPrompt = [
		'You are AI Canvas, an assistant that prepares structured outputs for a canvas-based workspace.',
		'Prefer concise, directly usable outputs.',
		...(input.contextMode !== 'none'
			? [
					`Current context mode: ${input.contextMode === 'selected' ? 'selected elements' : 'whole canvas'}.`,
				]
			: []),
		...(contextSnapshotSummary ? [contextSnapshotSummary] : []),
	].join('\n');

	if (generationMode === 'mermaid') {
		const previous = getLastDiagramArtifact(input.history);
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				previous?.mode === 'mermaid'
					? buildMermaidEditPrompt(input.message, previous.content)
					: buildMermaidPrompt(input.message),
			),
		});
		const code = extractCodeBlock(completion.text, 'mermaid');
		if (!code) {
			return null;
		}
		return {
			content: ['Generated a Mermaid diagram draft:', '', '```mermaid', code, '```'].join('\n'),
			artifacts: [{ type: 'mermaid', content: code }],
		};
	}

	if (generationMode === 'd2') {
		const previous = getLastDiagramArtifact(input.history);
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				previous?.mode === 'd2'
					? buildD2EditPrompt(input.message, previous.content)
					: buildD2Prompt(input.message),
			),
		});
		const code = extractCodeBlock(completion.text, 'd2');
		if (!code) {
			return null;
		}
		return {
			content: ['Generated a D2 diagram draft:', '', '```d2', code, '```'].join('\n'),
			artifacts: [{ type: 'd2', content: code }],
		};
	}

	if (generationMode === 'kanban') {
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(input, buildKanbanPrompt(input.message)),
		});
		const json = extractCodeBlock(completion.text, 'json');
		if (!json) {
			return null;
		}
		return {
			content: ['Generated kanban operations:', '', '```json', json, '```'].join('\n'),
			artifacts: [{ type: 'kanban-ops', content: json }],
		};
	}

	if (generationMode === 'prototype') {
		const currentPrototypeJson = input.prototypeContext
			? JSON.stringify(
					{
						title: input.prototypeContext.title,
						template: input.prototypeContext.template,
						activeFile: input.prototypeContext.activeFile,
						dependencies: input.prototypeContext.dependencies ?? {},
						preview: input.prototypeContext.preview,
						files: input.prototypeContext.files,
					},
					null,
					2,
				)
			: undefined;
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				buildPrototypePrompt(input.message, currentPrototypeJson),
			),
			maxTokens: 4000,
		});
		const json = extractCodeBlock(completion.text, 'json') ?? completion.text.trim();
		const prototype = parsePrototypeArtifactContent(json);
		if (
			!prototype ||
			isStarterPrototypeOutput(prototype) ||
			!isFunctionalPrototypeOutput(prototype, input.message)
		) {
			return null;
		}
		return {
			content: [
				'Prepared prototype files for the canvas.',
				'',
				`Prototype: ${prototype.title}`,
				'',
				'The response includes a full multi-file prototype payload for the custom runtime.',
			].join('\n'),
			artifacts: [{ type: 'prototype-files', content: serializePrototypeArtifact(prototype) }],
		};
	}

	if (generationMode === 'svg') {
		const previous = getLastSvgSource(input.history);
		const completion = await createAnthropicMessage(input.bindings, {
			system: [
				systemPrompt,
				'When the user asks for an SVG, produce vector-friendly illustration markup only.',
			].join('\n'),
			messages: buildAnthropicConversation(
				input,
				previous ? buildSvgEditPrompt(input.message, previous) : buildSvgPrompt(input.message),
			),
			maxTokens: 3000,
		});
		const svg = extractCodeBlock(completion.text, 'svg');
		if (!svg) {
			return null;
		}
		return {
			content: [
				'Prepared an SVG illustration draft for the canvas.',
				'',
				'```svg',
				svg,
				'```',
			].join('\n'),
		};
	}

	if (generationMode === 'chat') {
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(input, input.message),
		});
		if (!completion.text.trim()) {
			return null;
		}
		return {
			content: completion.text.trim(),
		};
	}

	if (generationMode === 'image' || generationMode === 'sketch') {
		const completion = await createAnthropicMessage(input.bindings, {
			system: systemPrompt,
			messages: buildAnthropicConversation(
				input,
				generationMode === 'sketch'
					? `Summarize the intended sketch output and canvas context for this request:\n${input.message}`
					: `Summarize the intended generated image output and canvas context for this request:\n${input.message}`,
			),
		});
		if (!completion.text.trim()) {
			return null;
		}
		return {
			content: completion.text.trim(),
		};
	}

	return null;
}

export async function generateAssistantResponse(
	input: AssistantServiceInput,
): Promise<AssistantServiceResult> {
	const generationMode = resolveGenerationMode(input);
	const selectedEditDraft = await buildSelectedEditDraft(input, generationMode);
	const draft = selectedEditDraft ?? (await buildAnthropicDraft(input)) ?? buildDraft(input);

	const message: AssistantMessage = {
		id: nanoid(),
		role: 'assistant',
		content: draft.content,
		generationMode,
		artifacts: (draft.artifacts ?? []) as AssistantArtifact[],
		createdAt: new Date().toISOString(),
	};

	return { message };
}
