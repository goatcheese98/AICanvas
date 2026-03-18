import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantKanbanPatchArtifact,
	AssistantMarkdownPatchArtifact,
	AssistantSelectedContext,
	GenerationMode,
	KanbanOverlayCustomData,
} from '@ai-canvas/shared/types';
import { createAnthropicMessage } from '../anthropic';
import { buildMarkdownRewritePrompt, extractCodeBlock } from '../parsing';
import type { AssistantDraft, AssistantServiceInput } from '../types';
import {
	isCreateNewArtifactIntent,
	isEditableSelectionRequest,
	normalizeSource,
	sentenceCase,
	truncateLabel,
} from './service-utils';

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

	for (const column of board.columns) {
		if (normalizedMessage.includes(column.title.toLowerCase())) {
			return column;
		}
	}

	if (/(done|complete|completed|ship|closed)/.test(normalizedMessage)) {
		return board.columns.at(-1) ?? board.columns[0] ?? null;
	}

	if (/(progress|active|working|doing)/.test(normalizedMessage)) {
		return board.columns[1] ?? board.columns[0] ?? null;
	}

	return board.columns[0] ?? null;
}

function detectMoveCardIntent(
	board: KanbanOverlayCustomData,
	message: string,
): { cardId: string; targetColumnId: string } | null {
	const match = message.match(/\bmove\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i);
	if (!match) return null;

	const cardQuery = match[1]?.trim().toLowerCase();
	const columnQuery = match[2]?.trim().toLowerCase();
	if (!cardQuery || !columnQuery) return null;

	const targetColumn = board.columns.find(
		(column) =>
			column.title.toLowerCase().includes(columnQuery) ||
			columnQuery.includes(column.title.toLowerCase()),
	);
	if (!targetColumn) return null;

	for (const column of board.columns) {
		const card = column.cards.find((c) => c.title.toLowerCase().includes(cardQuery));
		if (card) {
			return { cardId: card.id, targetColumnId: targetColumn.id };
		}
	}

	return null;
}

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

	const moveIntent = detectMoveCardIntent(board, message);
	if (moveIntent) {
		const { cardId, targetColumnId } = moveIntent;

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

export async function buildSelectedEditDraft(
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
