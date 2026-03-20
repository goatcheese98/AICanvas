import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantKanbanPatchArtifact,
	AssistantSelectedContext,
	KanbanOverlayCustomData,
} from '@ai-canvas/shared/types';
import { createAnthropicMessage } from '../anthropic';
import type { AssistantServiceInput } from '../types';
import { truncateLabel } from './service-utils';

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

export async function buildSelectedKanbanDraft(
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
