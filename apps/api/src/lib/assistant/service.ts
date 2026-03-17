import { normalizeKanbanOverlay, normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantKanbanPatchArtifact,
	AssistantMarkdownPatchArtifact,
	AssistantMessage,
	AssistantPrototypePatchArtifact,
	AssistantSelectedContext,
	GenerationMode,
	KanbanOverlayCustomData,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import { nanoid } from 'nanoid';
import { createAnthropicMessage } from './anthropic';
import { summarizeAssistantContextSnapshot } from './context';
import {
	buildD2EditPrompt,
	buildD2Prompt,
	buildKanbanPrompt,
	buildMarkdownRewritePrompt,
	buildMermaidEditPrompt,
	buildMermaidPrompt,
	buildPrototypePrompt,
	extractCodeBlock,
} from './parsing';
import type { AssistantDraft, AssistantServiceInput, AssistantServiceResult } from './types';

function sanitizeHistoryMessages(history: AssistantServiceInput['history']): AssistantMessage[] {
	if (!Array.isArray(history)) {
		return [];
	}

	return history
		.filter(
			(message) =>
				(message.role === 'user' || message.role === 'assistant') &&
				typeof message.content === 'string',
		)
		.slice(-12)
		.map((message) => ({
			id: message.id,
			role: message.role,
			content: message.content.trim().slice(0, 4000),
			generationMode: message.generationMode,
			artifacts: message.artifacts,
			createdAt: message.createdAt,
		}))
		.filter((message) => message.content.length > 0);
}

function buildAnthropicConversation(
	input: AssistantServiceInput,
	currentUserContent: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
	return [
		...sanitizeHistoryMessages(input.history).map((message) => ({
			role: message.role,
			content: message.content,
		})),
		{
			role: 'user',
			content: currentUserContent,
		},
	];
}

function inferPrototypeTemplate(
	input: AssistantServiceInput,
): PrototypeOverlayCustomData['template'] {
	const message = input.message.toLowerCase();

	if (
		/(vanilla|html\s*\/\s*css|html css|plain javascript|plain js|vanilla js|vanilla javascript)/.test(
			message,
		)
	) {
		return 'vanilla';
	}

	if (/(react|jsx|tsx)/.test(message)) {
		return 'react';
	}

	return input.prototypeContext?.template ?? 'react';
}

function buildPrototypeRequestSeed(
	input: Pick<AssistantServiceInput, 'message' | 'prototypeContext'>,
): string {
	const parts = [input.message.trim()];
	const currentTitle = input.prototypeContext?.title?.trim();

	if (currentTitle && !new RegExp(currentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(input.message)) {
		parts.push(`Selected prototype: ${currentTitle}`);
	}

	return parts.filter(Boolean).join('\n');
}

function getLastDiagramArtifact(
	history: AssistantServiceInput['history'],
): { mode: Extract<GenerationMode, 'mermaid' | 'd2'>; content: string } | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		for (const artifact of [...(message.artifacts ?? [])].reverse()) {
			if (
				(artifact.type === 'mermaid' || artifact.type === 'd2') &&
				artifact.content.trim().length > 0
			) {
				return { mode: artifact.type, content: artifact.content.trim() };
			}
		}

		if (message.role !== 'assistant') {
			continue;
		}

		if (message.generationMode === 'mermaid') {
			const code = extractCodeBlock(message.content, 'mermaid');
			if (code) {
				return { mode: 'mermaid', content: code };
			}
		}

		if (message.generationMode === 'd2') {
			const code = extractCodeBlock(message.content, 'd2');
			if (code) {
				return { mode: 'd2', content: code };
			}
		}
	}

	return null;
}

function isDiagramFollowUpRequest(message: string): boolean {
	return /(fix|update|adjust|change|edit|refine|improve|render|rerender|re-render|correct|repair|clean up|arrow|edge|line|label|node|spacing|align|move|swap|reverse|rotate|that|it|this|same diagram)/.test(
		message,
	);
}

function getLastMediaGenerationMode(
	history: AssistantServiceInput['history'],
): Extract<GenerationMode, 'image' | 'sketch'> | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		if (message.role !== 'assistant') {
			continue;
		}

		if (message.generationMode === 'image' || message.generationMode === 'sketch') {
			return message.generationMode;
		}
	}

	return null;
}

function isImageFollowUpRequest(message: string): boolean {
	return /\b(background|lighting|style|color|palette|scene|setting|composition|pose|expression|outfit|add|remove|change|adjust|update|refine|improve|variation|version|another|different|with|without|make it|keep the|same subject|same image|proceed|go ahead|do it|yes|yep|let's do|lets do|try that)\b/.test(
		message,
	);
}

export function resolveGenerationMode(input: AssistantServiceInput): GenerationMode {
	if (input.generationMode) {
		return input.generationMode;
	}

	const message = input.message.toLowerCase();
	const hasExplicitImageIntent =
		/\b(generate|create|make|render|design)\s+(?:an?\s+)?(?:image|illustration|photo|poster|artwork|hero image|hero illustration|cover image)\b/.test(
			message,
		) ||
		/\b(?:image|illustration|photo|poster|artwork|hero image|hero illustration|cover image)\s+of\b/.test(
			message,
		);

	if (/\bd2\b/.test(message)) {
		return 'd2';
	}

	if (/(kanban|backlog|sprint board|task board|turn this into tasks|plan tasks)/.test(message)) {
		return 'kanban';
	}

	if (
		/(mermaid|flowchart|sequence diagram|state diagram|architecture diagram|diagram this|diagram the)/.test(
			message,
		)
	) {
		return 'mermaid';
	}

	if (/(wireframe|hand-drawn sketch|sketch this|whiteboard sketch)/.test(message)) {
		return 'sketch';
	}

	if (hasExplicitImageIntent) {
		return 'image';
	}

	if (
		/(prototype|protoype|prototype|propotype|mockup|landing page|landing-page|react app|dashboard ui|ui prototype|build a component|build a page|vanilla js|vanilla javascript|html css|jsx|tsx)/.test(
			message,
		) ||
		(Boolean(input.prototypeContext) &&
			(
				/(react|vanilla|html|css|javascript|js|jsx|tsx|convert|rewrite|migrate|refactor|restyle|rebuild)/.test(
					message,
				) || isEditableSelectionRequest(message)
			))
	) {
		return 'prototype';
	}

	if (
		/(generate an image|create an image|hero illustration|illustration|cover image)/.test(message)
	) {
		return 'image';
	}

	const lastDiagramArtifact = getLastDiagramArtifact(input.history);
	if (lastDiagramArtifact && isDiagramFollowUpRequest(message)) {
		return lastDiagramArtifact.mode;
	}

	const lastMediaGenerationMode = getLastMediaGenerationMode(input.history);
	if (lastMediaGenerationMode && isImageFollowUpRequest(message)) {
		return lastMediaGenerationMode;
	}

	return 'chat';
}

function sentenceCase(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	if (!trimmed) return 'Untitled';
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
		(context) =>
			context.kind === 'markdown' || context.kind === 'kanban' || context.kind === 'prototype',
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

function listChangedPrototypeFiles(
	base: PrototypeOverlayCustomData,
	next: PrototypeOverlayCustomData,
): string[] {
	const filePaths = new Set([...Object.keys(base.files), ...Object.keys(next.files)]);

	return [...filePaths]
		.filter((path) => {
			const baseFile = base.files[path];
			const nextFile = next.files[path];
			return JSON.stringify(baseFile ?? null) !== JSON.stringify(nextFile ?? null);
		})
		.sort((left, right) => left.localeCompare(right));
}

async function createPrototypePatchArtifact(
	context: Extract<AssistantSelectedContext, { kind: 'prototype' }>,
	input: AssistantServiceInput,
	bindings?: AssistantServiceInput['bindings'],
): Promise<AssistantArtifact> {
	const base = normalizePrototypeOverlay(
		input.prototypeContext ?? {
			type: 'prototype',
			title: context.prototype.title,
			template: context.prototype.template,
			activeFile: context.prototype.activeFile,
			files: {},
		},
	);
	const requestSeed = buildPrototypeRequestSeed({
		message: input.message,
		prototypeContext: base,
	});

	if (bindings?.ANTHROPIC_API_KEY) {
		try {
			const completion = await createAnthropicMessage(bindings, {
				system: [
					'You are AI Canvas, editing a selected prototype.',
					'Return ONLY a JSON object for the full updated prototype state.',
					'Do not return prose, JSX snippets, markdown fences, or explanations.',
				].join('\n'),
				messages: [
					{
						role: 'user',
						content: buildPrototypePrompt(
							input.message,
							JSON.stringify(
								{
									title: base.title,
									template: base.template,
									activeFile: base.activeFile,
									dependencies: base.dependencies ?? {},
									preview: base.preview,
									files: base.files,
								},
								null,
								2,
							),
						),
					},
				],
				maxTokens: 4000,
			});

			const responseText = completion.text.trim();
			const jsonText = responseText
				.replace(/^```(?:json)?\s*/i, '')
				.replace(/\s*```$/, '')
				.trim();
			const nextPrototype = parsePrototypeArtifactContent(jsonText);

			if (
				nextPrototype &&
				!isStarterPrototypeOutput(nextPrototype) &&
				(!expectsFunctionalPrototype(requestSeed) ||
					isFunctionalPrototypeOutput(nextPrototype, requestSeed))
			) {
				const patch: AssistantPrototypePatchArtifact = {
					kind: 'prototype_patch',
					targetId: context.id,
					summary: `Updates the selected prototype "${base.title}" to satisfy the edit request.`,
					base,
					next: nextPrototype,
					changedFiles: listChangedPrototypeFiles(base, nextPrototype),
				};
				return {
					type: 'prototype-patch',
					content: JSON.stringify(patch, null, 2),
				};
			}
		} catch {
			// Fall back to the deterministic prototype builder below.
		}
	}

	const nextPrototype = buildPromptDrivenPrototype({
		...input,
		prototypeContext: base,
	});
	const patch: AssistantPrototypePatchArtifact = {
		kind: 'prototype_patch',
		targetId: context.id,
		summary: `Updates the selected prototype "${base.title}" to satisfy the edit request.`,
		base,
		next: nextPrototype,
		changedFiles: listChangedPrototypeFiles(base, nextPrototype),
	};

	return {
		type: 'prototype-patch',
		content: JSON.stringify(patch, null, 2),
	};
}

async function buildSelectedEditDraft(
	input: AssistantServiceInput,
	generationMode: GenerationMode,
): Promise<AssistantDraft | null> {
	const editableContexts = getSelectedEditableContexts(input);
	const isSinglePrototypeEdit =
		editableContexts.length === 1 && editableContexts[0]?.kind === 'prototype';
	if (
		!isEditableSelectionRequest(input.message) ||
		(isCreateNewArtifactIntent(input.message) && !isSinglePrototypeEdit)
	) {
		return null;
	}

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
			continue;
		}

		if (context.kind === 'prototype' && (generationMode === 'chat' || generationMode === 'prototype')) {
			artifacts.push(await createPrototypePatchArtifact(context, input, input.bindings));
		}
	}

	if (artifacts.length === 0) {
		return null;
	}

	const artifactLabels = artifacts.map((artifact) => {
		if (artifact.type === 'markdown-patch') return 'markdown patch';
		if (artifact.type === 'kanban-patch') return 'kanban patch';
		return 'prototype patch';
	});

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
			/\b(please|kindly|just|can you|could you|would you|help me|i need|i want|show me|give me|create|build|make|design|prototype|website|landing page|landing-page|page|dashboard|tool)\b/gi,
			' ',
		)
		.replace(/\b(with|using|including|featuring)\b[\s\S]*$/i, ' ')
		.replace(/[^\w\s-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trimStart()
		.replace(/^(of\s+)?(a|an|the)\s+/i, '')
		.replace(/^of\s+/i, '')
		.trim();
	return subject || 'AI Product';
}

function buildPrototypeAppTitle(subjectTitle: string): string {
	return /\b(app|studio|workspace|dashboard|tool)\b$/i.test(subjectTitle)
		? subjectTitle
		: `${subjectTitle} App`;
}

function buildPrototypeGameTitle(subjectTitle: string): string {
	return /\b(game|arcade|puzzle)\b$/i.test(subjectTitle) ? subjectTitle : `${subjectTitle} Game`;
}

type PrototypeRequestVariant = 'calculator' | 'dashboard' | 'game' | 'app' | 'landing';

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

	return /calculator|todo|timer|tracker|converter|quiz|editor|generator|planner|tool|utility|app|game|play|arcade|puzzle|level|score|board/.test(
		normalized,
	);
}

function inferPrototypeVariant(message: string): PrototypeRequestVariant {
	const normalized = message.toLowerCase();

	if (/calculator/.test(normalized)) {
		return 'calculator';
	}

	if (/dashboard|admin|analytics|workspace|portal|command center/.test(normalized)) {
		return 'dashboard';
	}

	if (/game|arcade|puzzle|tetris|platformer|runner|shooter/.test(normalized)) {
		return 'game';
	}

	return expectsFunctionalPrototype(message) ? 'app' : 'landing';
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
	const title = truncateTitle(buildPrototypeAppTitle(subjectTitle));
	const introCopy =
		'Tap the keypad to build an expression, then press = to evaluate it.';
	const sharedCalculatorCss = `* {
  box-sizing: border-box;
}

:root {
  font-family: "Söhne", "Inter", "Segoe UI", sans-serif;
  color: #e2e8f0;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background: #0f172a;
}

button {
  border: 0;
  cursor: pointer;
}

.calc-shell {
  min-height: 100%;
  padding: clamp(12px, 2.4vw, 20px);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, ${palette.accent} 26%, transparent) 0, transparent 44%),
    radial-gradient(circle at bottom right, rgba(250, 204, 21, 0.18) 0, transparent 36%),
    linear-gradient(160deg, #0b1120 0%, #101828 56%, #172554 100%);
}

.calc-stage {
  min-height: calc(100vh - 32px);
  display: grid;
  gap: 18px;
  padding: clamp(16px, 3.6cqi, 30px);
  border-radius: 32px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.62)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 45%);
  box-shadow: 0 36px 120px rgba(15, 23, 42, 0.42);
  container-type: inline-size;
}

.calc-header {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr);
  gap: 16px;
  align-items: start;
}

.calc-kicker,
.calc-panel-label,
.calc-overview-label,
.calc-side-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.62);
}

.calc-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.calc-kicker::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${palette.accent};
  box-shadow: 0 0 18px color-mix(in srgb, ${palette.accent} 60%, white);
}

h1 {
  margin: 12px 0 0;
  max-width: 10ch;
  font-size: clamp(36px, 8cqi, 68px);
  line-height: 0.92;
  letter-spacing: -0.04em;
}

p {
  margin: 12px 0 0;
  max-width: 46ch;
  color: rgba(226, 232, 240, 0.74);
  line-height: 1.58;
}

.calc-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.calc-overview-card {
  padding: 14px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px);
}

.calc-overview-value {
  display: block;
  margin-top: 8px;
  font-size: clamp(18px, 4.4cqi, 28px);
  font-weight: 800;
  color: white;
}

.calc-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
}

.calc-main {
  display: grid;
  gap: 14px;
}

.calc-display-panel {
  padding: 18px;
  border-radius: 26px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.78)),
    linear-gradient(135deg, color-mix(in srgb, ${palette.accent} 18%, transparent), transparent 48%);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.calc-expression {
  margin-top: 14px;
  color: white;
  font-size: clamp(34px, 10cqi, 72px);
  font-weight: 800;
  line-height: 0.92;
  text-align: right;
  word-break: break-all;
}

.calc-hint {
  margin-top: 10px;
  color: rgba(226, 232, 240, 0.56);
  font-size: 13px;
  line-height: 1.45;
}

.calc-keypad-panel,
.calc-side-section {
  border-radius: 26px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(248, 250, 252, 0.97);
  color: #0f172a;
}

.calc-keypad-panel {
  padding: 14px;
  display: grid;
  gap: 10px;
}

.keypad-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.calc-button {
  min-height: clamp(56px, 11cqi, 78px);
  border-radius: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #edf2f7 100%);
  color: #0f172a;
  font-size: clamp(20px, 4.5cqi, 28px);
  font-weight: 800;
  transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.calc-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.1);
}

.calc-button--accent {
  background: linear-gradient(180deg, ${palette.accent} 0%, color-mix(in srgb, ${palette.accent} 72%, #7c2d12) 100%);
  color: white;
}

.calc-button--ghost {
  background: linear-gradient(180deg, #dbe3ef 0%, #cbd5e1 100%);
  color: #334155;
}

.calc-button--wide {
  grid-column: span 2;
}

.calc-side-panel {
  display: grid;
  gap: 12px;
  align-content: start;
}

.calc-side-section {
  padding: 16px;
}

.calc-side-section--accent {
  background: linear-gradient(160deg, color-mix(in srgb, ${palette.accent} 14%, white), #fff8eb 100%);
}

.calc-side-title {
  color: #64748b;
}

.calc-history-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.calc-history-row,
.calc-tip {
  border-radius: 16px;
  background: #f8fafc;
  padding: 12px 14px;
  color: #334155;
  line-height: 1.4;
}

.calc-tip-list {
  display: grid;
  gap: 10px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

@container (max-width: 940px) {
  .calc-header,
  .calc-workbench {
    grid-template-columns: 1fr;
  }

  .calc-overview {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (max-width: 640px) {
  .calc-stage {
    min-height: auto;
    gap: 14px;
    padding: 14px;
  }

  .calc-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .keypad-row {
    gap: 8px;
  }
}

@container (max-width: 460px) {
  h1 {
    max-width: none;
  }

  .calc-overview {
    grid-template-columns: 1fr;
  }

  .calc-button {
    min-height: 52px;
    border-radius: 18px;
  }
}`;
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
    <main class="calc-shell">
      <section class="calc-stage">
        <header class="calc-header">
          <div class="calc-header-copy">
            <div class="calc-kicker">Expression lab</div>
            <h1>${title}</h1>
            <p>${introCopy}</p>
          </div>
        </header>

        <section class="calc-workbench">
          <section class="calc-main">
            <section class="calc-display-panel">
              <div class="calc-panel-label">Expression</div>
              <div id="display" class="calc-expression">12+8</div>
              <div class="calc-hint">Supports multi-step arithmetic like (12+8)*3 or 48/6+7.</div>
            </section>
            <section id="keypad" class="calc-keypad-panel"></section>
          </section>
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
let expression = '12+8';

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
`;
		const css = sharedCalculatorCss;
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
				eyebrow: 'Expression Lab',
				title,
				description:
					'A working calculator with live arithmetic controls in a canvas-friendly layout.',
				accent: palette.accent,
				background: palette.background,
				badges: ['Calculator', 'Responsive', 'Vanilla'],
				metrics: [],
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
      setExpression(result);
    }
  };

  return (
    <main className="calc-shell">
      <section className="calc-stage">
        <header className="calc-header">
          <div className="calc-header-copy">
            <span className="calc-kicker">Expression lab</span>
            <h1>${title}</h1>
            <p>${introCopy}</p>
          </div>
        </header>

        <section className="calc-workbench">
          <section className="calc-main">
            <section className="calc-display-panel">
              <div className="calc-panel-label">Expression</div>
              <div className="calc-expression">{expression}</div>
              <div className="calc-hint">Supports multi-step arithmetic like (12+8)*3 or 48/6+7.</div>
            </section>

            <section className="calc-keypad-panel">
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
            </section>
          </section>
        </section>
      </section>
    </main>
  );
}
`;
	const css = sharedCalculatorCss;
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
			eyebrow: 'Expression Lab',
			title,
			description:
				'A working calculator with live arithmetic controls in a canvas-friendly layout.',
			accent: palette.accent,
			background: palette.background,
			badges: ['Calculator', 'Responsive', 'React'],
			metrics: [],
		},
	});
}

function buildPromptDrivenPrototype(input: AssistantServiceInput): PrototypeOverlayCustomData {
	const requestSeed = buildPrototypeRequestSeed(input);
	const subject = extractPrototypeSubject(requestSeed);
	const subjectTitle = toTitleWords(subject).slice(0, 36);
	const brand = subjectTitle.split(/\s+/).slice(0, 2).join(' ') || 'Canvas Forge';
	const palette = pickPrototypePalette(input.prototypeContext?.title ?? subject);
	const template = inferPrototypeTemplate(input);
	const variant = inferPrototypeVariant(requestSeed);

	if (variant === 'calculator') {
		return buildCalculatorPrototype(subjectTitle, palette, template);
	}
	if (variant !== 'game') {
		const title = truncateTitle(
			variant === 'dashboard'
				? `${brand} Dashboard`
				: variant === 'app'
					? buildPrototypeAppTitle(subjectTitle)
					: `${brand} Website`,
		);

		return normalizePrototypeOverlay({
			title,
			template,
			preview: {
				eyebrow:
					variant === 'dashboard'
						? 'Dashboard Concept'
						: variant === 'app'
							? 'App Concept'
							: 'Landing Concept',
				title,
				description: `Blank prototype scaffold for ${subjectTitle || 'the requested concept'}.`,
				accent: palette.accent,
				background: palette.background,
				badges: [],
				metrics: [],
			},
		});
	}
	const title = truncateTitle(buildPrototypeGameTitle(subjectTitle));
	const headline = `Play ${subjectTitle.toLowerCase()} directly on the canvas.`;
	const summary = `Prototype the moment-to-moment feel of ${subject.toLowerCase()} with a playable board, visible scoring, and responsive controls that adapt as the canvas resizes.`;
	const previewDescription =
		'A playable game board with responsive controls, visible scoring, and canvas-friendly resizing.';
	const badges = ['Playable', 'Responsive', 'Canvas'];
	const metrics = [
		{ label: 'Score', value: '0000' },
		{ label: 'Lines', value: '0' },
		{ label: 'Level', value: '1' },
	];
	const jsx =
		`import { useEffect, useState } from 'react';
import './styles.css';

const BOARD_ROWS = 16;
const BOARD_COLUMNS = 10;
const LINE_SCORES = { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 };
const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  L: [[1, 0], [1, 0], [1, 1]],
  J: [[0, 1], [0, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
};
const PIECE_TYPES = Object.keys(PIECES);

function createEmptyBoard() {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLUMNS).fill(0));
}

function randomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

function createPiece(type) {
  const shape = PIECES[type];
  return {
    type,
    shape,
    row: 0,
    column: Math.floor((BOARD_COLUMNS - shape[0].length) / 2),
  };
}

function rotateShape(shape) {
  return shape[0].map((_, columnIndex) => shape.map((row) => row[columnIndex]).reverse());
}

function collides(board, piece, shape = piece.shape, row = piece.row, column = piece.column) {
  for (let rowIndex = 0; rowIndex < shape.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < shape[rowIndex].length; columnIndex += 1) {
      if (!shape[rowIndex][columnIndex]) continue;

      const nextRow = row + rowIndex;
      const nextColumn = column + columnIndex;

      if (nextColumn < 0 || nextColumn >= BOARD_COLUMNS || nextRow >= BOARD_ROWS) {
        return true;
      }

      if (nextRow >= 0 && board[nextRow][nextColumn]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece(board, piece) {
  return board.map((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      const occupiesCell = piece.shape.some((shapeRow, shapeRowIndex) =>
        shapeRow.some(
          (value, shapeColumnIndex) =>
            value &&
            piece.row + shapeRowIndex === rowIndex &&
            piece.column + shapeColumnIndex === columnIndex,
        ),
      );
      return occupiesCell ? 1 : cell;
    }),
  );
}

function clearCompletedLines(board) {
  const remainingRows = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = BOARD_ROWS - remainingRows.length;
  const paddingRows = Array.from({ length: cleared }, () => Array(BOARD_COLUMNS).fill(0));

  return {
    board: [...paddingRows, ...remainingRows],
    cleared,
  };
}

function createDisplayBoard(board, piece) {
  return board.map((row) => [...row]).map((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      const isActive = piece.shape.some((shapeRow, shapeRowIndex) =>
        shapeRow.some(
          (value, shapeColumnIndex) =>
            value &&
            piece.row + shapeRowIndex === rowIndex &&
            piece.column + shapeColumnIndex === columnIndex,
        ),
      );

      return isActive ? 2 : cell;
    }),
  );
}

function createInitialGame() {
  const currentType = randomPieceType();
  const nextType = randomPieceType();

  return {
    board: createEmptyBoard(),
    piece: createPiece(currentType),
    nextType,
    score: 0,
    lines: 0,
    status: 'Arrow keys move, Arrow Down drops, and Space hard drops.',
    gameOver: false,
  };
}

function lockPiece(state, piece) {
  const mergedBoard = mergePiece(state.board, piece);
  const { board, cleared } = clearCompletedLines(mergedBoard);
  const lines = state.lines + cleared;
  const score = state.score + 12 + (LINE_SCORES[cleared] ?? 0);
  const nextPiece = createPiece(state.nextType);
  const nextType = randomPieceType();
  const gameOver = collides(board, nextPiece);

  return {
    board,
    piece: nextPiece,
    nextType,
    score,
    lines,
    status: gameOver
      ? 'Game over. Press restart to play again.'
      : cleared > 0
        ? 'Cleared ' + cleared + ' line' + (cleared === 1 ? '' : 's') + '.'
        : 'Piece locked. Keep the stack flat to avoid topping out.',
    gameOver,
  };
}

export default function App() {
  const [game, setGame] = useState(() => createInitialGame());
  const level = Math.floor(game.lines / 5) + 1;
  const displayBoard = createDisplayBoard(game.board, game.piece);

  const moveHorizontal = (delta) => {
    setGame((current) => {
      if (current.gameOver) return current;
      const nextPiece = { ...current.piece, column: current.piece.column + delta };
      return collides(current.board, nextPiece) ? current : { ...current, piece: nextPiece };
    });
  };

  const rotateCurrent = () => {
    setGame((current) => {
      if (current.gameOver) return current;
      const rotated = rotateShape(current.piece.shape);
      const kickOffsets = [0, -1, 1, -2, 2];

      for (const offset of kickOffsets) {
        const candidate = {
          ...current.piece,
          shape: rotated,
          column: current.piece.column + offset,
        };
        if (!collides(current.board, candidate)) {
          return { ...current, piece: candidate };
        }
      }

      return current;
    });
  };

  const softDrop = () => {
    setGame((current) => {
      if (current.gameOver) return current;
      const nextPiece = { ...current.piece, row: current.piece.row + 1 };
      return collides(current.board, nextPiece)
        ? lockPiece(current, current.piece)
        : { ...current, piece: nextPiece };
    });
  };

  const hardDrop = () => {
    setGame((current) => {
      if (current.gameOver) return current;
      let droppedPiece = current.piece;
      while (!collides(current.board, { ...droppedPiece, row: droppedPiece.row + 1 })) {
        droppedPiece = { ...droppedPiece, row: droppedPiece.row + 1 };
      }
      return lockPiece(current, droppedPiece);
    });
  };

  const restart = () => {
    setGame(createInitialGame());
  };

  useEffect(() => {
    if (game.gameOver) {
      return undefined;
    }

    const delay = Math.max(180, 700 - (level - 1) * 45);
    const timer = window.setInterval(() => {
      setGame((current) => {
        if (current.gameOver) return current;
        const nextPiece = { ...current.piece, row: current.piece.row + 1 };
        return collides(current.board, nextPiece)
          ? lockPiece(current, current.piece)
          : { ...current, piece: nextPiece };
      });
    }, delay);

    return () => window.clearInterval(timer);
  }, [game.gameOver, level]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;

      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) {
        event.preventDefault();
      }

      if (event.key === 'ArrowLeft') moveHorizontal(-1);
      if (event.key === 'ArrowRight') moveHorizontal(1);
      if (event.key === 'ArrowDown') softDrop();
      if (event.key === 'ArrowUp') rotateCurrent();
      if (event.key === ' ') hardDrop();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame game-frame">
        <header className="game-header">
          <div>
            <div className="eyebrow">Playable prototype</div>
            <h1>${headline}</h1>
            <p>${summary}</p>
          </div>
          <div className="game-metrics">
            {[
              { label: 'Score', value: String(game.score).padStart(4, '0') },
              { label: 'Lines', value: String(game.lines) },
              { label: 'Level', value: String(level) },
            ].map((metric) => (
              <article key={metric.label} className="metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        </header>

        <section className="game-layout">
          <section className="board-shell">
            <div className="board-hud">
              <div>
                <div className="panel-title">Current piece</div>
                <strong>{game.piece.type}</strong>
              </div>
              <div className="board-score">
                <span>Next {game.nextType}</span>
                <span>{game.gameOver ? 'Game over' : 'Live demo'}</span>
              </div>
            </div>

            <div className="game-board" aria-label="${title} board">
              {displayBoard.flatMap((row, rowIndex) =>
                row.map((cell, columnIndex) => (
                  <div
                    key={rowIndex + '-' + columnIndex}
                    className={[
                      'board-cell',
                      cell === 1 ? 'board-cell--filled' : '',
                      cell === 2 ? 'board-cell--active' : '',
                    ].filter(Boolean).join(' ')}
                  />
                )),
              )}
            </div>
          </section>

          <aside className="game-sidebar">
            <section className="panel">
              <div className="panel-title">Controls</div>
              <div className="control-grid">
                <button type="button" className="primary-button" onClick={() => moveHorizontal(-1)}>Move Left</button>
                <button type="button" className="primary-button" onClick={() => moveHorizontal(1)}>Move Right</button>
                <button type="button" className="secondary-button" onClick={rotateCurrent}>Rotate</button>
                <button type="button" className="secondary-button" onClick={softDrop}>Soft Drop</button>
                <button type="button" className="secondary-button" onClick={hardDrop}>Hard Drop</button>
                <button type="button" className="secondary-button" onClick={restart}>Restart</button>
              </div>
            </section>

            <section className="panel panel-accent-soft">
              <div className="panel-title">Status</div>
              <div className="app-list">
                <div className="proof-row">{game.status}</div>
                <div className="proof-row">Arrow keys move, Arrow Up rotates, and Space hard drops.</div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">Next piece</div>
              <div className="queue-card">
                <strong>{game.nextType} queued</strong>
                <p>Keep the stack flat so the next spawn still has room.</p>
                <button type="button" className="secondary-button" onClick={restart}>Restart run</button>
              </div>
            </section>
          </aside>
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
  container-type: inline-size;
}

.dashboard-frame {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  container-type: inline-size;
}

.game-frame {
  display: grid;
  gap: 18px;
  padding: 18px;
  container-type: inline-size;
}

.game-header {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 18px;
}

.board-shell {
  display: grid;
  gap: 14px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.92));
  color: white;
  padding: 18px;
}

.board-hud {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
}

.board-score {
  display: grid;
  gap: 6px;
  text-align: right;
  color: rgba(226, 232, 240, 0.8);
  font-size: 14px;
}

.game-board {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 6px;
  min-height: clamp(320px, 56cqi, 640px);
}

.board-cell {
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.08);
}

.board-cell--filled {
  background: rgba(59, 130, 246, 0.4);
}

.board-cell--active {
  background: var(--accent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 54%, transparent);
}

.game-sidebar,
.game-metrics {
  display: grid;
  gap: 14px;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.panel-accent-soft {
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.queue-card {
  display: grid;
  gap: 12px;
  margin-top: 12px;
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
  .game-header,
  .game-layout,
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

@container (max-width: 760px) {
  .game-header,
  .game-layout,
  .hero-card,
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

@container (max-width: 520px) {
  .game-board {
    gap: 4px;
  }

  .control-grid,
  .feature-grid,
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
`;
	const base = normalizePrototypeOverlay({
		title,
		template,
	});

	return normalizePrototypeOverlay({
		...base,
		title,
		dependencies: {},
		activeFile: '/App.jsx',
		files: {
			...base.files,
			'/App.jsx': createPrototypeFile(jsx),
			'/index.jsx': createPrototypeFile(base.files['/index.jsx']?.code ?? '', { hidden: true }),
			'/styles.css': createPrototypeFile(css),
		},
		preview: {
			eyebrow: 'Playable prototype',
			title,
			description: previewDescription,
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

function collectPrototypeSourceText(prototype: PrototypeOverlayCustomData): string {
	return [
		prototype.title,
		JSON.stringify(prototype.preview ?? {}),
		...Object.values(prototype.files).map((file) => file.code ?? ''),
	].join('\n');
}

function countPrototypePatternMatches(text: string, patterns: RegExp[]): number {
	return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function hasInteractivePrototypeBehavior(appCode: string): boolean {
	const hasState = /useState|useReducer/.test(appCode);
	const hasInteraction =
		/onClick|onSubmit|onChange|onKeyDown|onKeyUp|addEventListener\(['"]keydown/.test(appCode);

	return hasState && hasInteraction;
}

function looksLikeMarketingPrototype(sourceText: string): boolean {
	const exactMatches = [
		/Start Free/i,
		/Book Demo/i,
		/See the tour/i,
		/Conversion-ready website/i,
		/landing page/i,
		/marketing site/i,
		/landing-frame/i,
		/hero-card--landing/i,
		/\bhomepage\b/i,
	];
	if (exactMatches.some((pattern) => pattern.test(sourceText))) {
		return true;
	}

	return (
		countPrototypePatternMatches(sourceText, [
			/\bpricing\b/i,
			/\bwaitlist\b/i,
			/\btestimonials?\b/i,
			/\bcase studies?\b/i,
			/\bcontact sales\b/i,
			/\bfree trial\b/i,
			/\brequest access\b/i,
			/\bjoin the beta\b/i,
			/\bcta-band\b/i,
			/\bbook a demo\b/i,
			/\bget started free\b/i,
		]) >= 2
	);
}

function hasGamePrototypeScaffolding(sourceText: string): boolean {
	const boardSignals =
		/game-board|playfield|board|arena|grid|cell|tile|tetromino|piece|boardRows|boardColumns/i;
	const scoreSignals =
		/\bscore\b|\blines\b|\blevel\b|\bcombo\b|\bqueue\b|\bnext piece\b|\bhigh score\b/i;
	const controlSignals =
		/move left|move right|rotate|hard drop|drop|restart|pause|ArrowLeft|ArrowRight|ArrowDown|keydown|onKeyDown/i;

	return (
		[boardSignals, scoreSignals, controlSignals].filter((pattern) => pattern.test(sourceText))
			.length >= 2
	);
}

function hasDashboardPrototypeScaffolding(sourceText: string): boolean {
	return (
		countPrototypePatternMatches(sourceText, [
			/metric-grid|metric-card/i,
			/\bsidebar\b/i,
			/\bpanel\b/i,
			/\btable\b/i,
			/\bactivity\b/i,
			/\banalytics\b/i,
			/\bfilters?\b/i,
			/\bcommand center\b/i,
		]) >= 2
	);
}

function hasAppPrototypeScaffolding(sourceText: string): boolean {
	return (
		countPrototypePatternMatches(sourceText, [
			/<input\b/i,
			/<textarea\b/i,
			/<select\b/i,
			/<form\b/i,
			/\.map\(/,
			/\bset[A-Z][A-Za-z0-9_]*\(/,
			/\b(items?|tasks?|entries?|results?|filters?|workspace|editor|preview|list|queue|board)\b/i,
			/\baddItem\b|\baddTask\b|\bremoveItem\b|\btoggleItem\b/i,
		]) >= 3
	);
}

function isFunctionalPrototypeOutput(
	prototype: PrototypeOverlayCustomData,
	message: string,
): boolean {
	const variant = inferPrototypeVariant(message);
	const appCode = normalizeSource(prototype.files['/App.jsx']?.code);
	const sourceText = collectPrototypeSourceText(prototype);

	if (looksLikeMarketingPrototype(sourceText)) {
		return false;
	}

	if (variant === 'calculator') {
		const hasCalculatorBehavior =
			appCode.includes('evaluateExpression') ||
			appCode.includes('CalculatorButton') ||
			appCode.includes("label: '='") ||
			appCode.includes("label: '÷'");
		return hasInteractivePrototypeBehavior(appCode) && hasCalculatorBehavior;
	}

	if (variant === 'game') {
		return hasInteractivePrototypeBehavior(appCode) && hasGamePrototypeScaffolding(sourceText);
	}

	if (variant === 'dashboard') {
		return hasDashboardPrototypeScaffolding(sourceText);
	}

	return hasInteractivePrototypeBehavior(appCode) && hasAppPrototypeScaffolding(sourceText);
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
		case 'prototype':
			return buildPrototypeDraft(input);
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
		const prototypeRequestSeed = buildPrototypeRequestSeed(input);
		const prototypeRequestVariant = inferPrototypeVariant(prototypeRequestSeed);
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
		const sourceText = prototype ? collectPrototypeSourceText(prototype) : '';
		if (
			!prototype ||
			isStarterPrototypeOutput(prototype) ||
			(prototypeRequestVariant === 'landing' && looksLikeMarketingPrototype(sourceText)) ||
			(expectsFunctionalPrototype(prototypeRequestSeed) &&
				!isFunctionalPrototypeOutput(prototype, prototypeRequestSeed))
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
