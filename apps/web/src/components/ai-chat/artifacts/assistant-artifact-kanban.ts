import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantKanbanPatchArtifact,
	KanbanCard,
	KanbanColumn,
	KanbanOverlayCustomData,
} from '@ai-canvas/shared/types';

type KanbanOp =
	| {
			op: 'add_column';
			column: Pick<KanbanColumn, 'id' | 'title'> & Partial<KanbanColumn>;
	  }
	| {
			op: 'add_card';
			columnId: string;
			card: Partial<KanbanCard> & Pick<KanbanCard, 'title'>;
	  }
	| {
			type: 'add_column';
			id: string;
			title: string;
			position?: number;
			color?: string;
	  }
	| {
			type: 'add_card';
			id?: string;
			column_id?: string;
			column?: string;
			title: string;
			description?: string;
			priority?: KanbanCard['priority'];
			labels?: string[];
			due_date?: string;
			position?: number;
	  }
	| {
			operation: 'add_column';
			id: string;
			title: string;
			order?: number;
			color?: string;
	  }
	| {
			operation: 'add_card';
			id?: string;
			column_id: string;
			title: string;
			description?: string;
			priority?: KanbanCard['priority'];
			labels?: string[];
			due_date?: string;
	  };

type ExtendedKanbanOp =
	| KanbanOp
	| {
			op: 'update_card';
			column?: string;
			columnId?: string;
			card_index?: number;
			cardIndex?: number;
			updates?: Partial<KanbanCard> & {
				checklist?: Array<string | { text?: string; done?: boolean }>;
			};
	  }
	| {
			op: 'move_card';
			from_column?: string;
			fromColumn?: string;
			to_column?: string;
			toColumn?: string;
			card_index?: number;
			cardIndex?: number;
			target_index?: number;
			targetIndex?: number;
	  };

interface NormalizedKanbanColumn {
	id: string;
	title: string;
	order: number;
	color?: string;
}

interface NormalizedKanbanCard {
	id: string;
	columnId: string;
	title: string;
	description?: string;
	priority?: KanbanCard['priority'];
	labels?: string[];
	dueDate?: string;
	checklist?: KanbanCard['checklist'];
}

function normalizeChecklistItems(checklist: unknown): KanbanCard['checklist'] {
	if (!Array.isArray(checklist)) {
		return [];
	}

	return checklist
		.map((item) => {
			if (typeof item === 'string') {
				const text = item.trim();
				return text ? { text, done: false } : null;
			}

			if (item && typeof item === 'object') {
				const text =
					typeof (item as { text?: unknown }).text === 'string'
						? (item as { text: string }).text.trim()
						: '';
				if (!text) {
					return null;
				}
				return {
					text,
					done: Boolean((item as { done?: unknown }).done),
				};
			}

			return null;
		})
		.filter(Boolean) as KanbanCard['checklist'];
}

function findColumnByReference(
	columns: KanbanColumn[],
	reference?: string,
): KanbanColumn | undefined {
	if (!reference) {
		return undefined;
	}

	return columns.find((column) => column.id === reference || column.title === reference);
}

function findColumnByReferenceWithNormalized(
	columns: KanbanColumn[],
	normalizedColumns: NormalizedKanbanColumn[],
	reference?: string,
): KanbanColumn | NormalizedKanbanColumn | undefined {
	if (!reference) {
		return undefined;
	}

	const normalized = normalizedColumns.find(
		(column) => column.id === reference || column.title === reference,
	);
	if (normalized) {
		return normalized;
	}

	return columns.find((column) => column.id === reference || column.title === reference);
}

function createDefaultKanbanBoard(title = 'AI Kanban Board'): KanbanOverlayCustomData {
	return {
		type: 'kanban',
		title,
		columns: [
			{ id: crypto.randomUUID(), title: 'To Do', cards: [] },
			{ id: crypto.randomUUID(), title: 'In Progress', cards: [] },
			{ id: crypto.randomUUID(), title: 'Done', cards: [] },
		],
	};
}

export function parseKanbanPatchArtifact(
	artifact: AssistantArtifact,
): AssistantKanbanPatchArtifact | null {
	if (artifact.type !== 'kanban-patch') {
		return null;
	}

	try {
		const parsed = JSON.parse(artifact.content) as AssistantKanbanPatchArtifact;
		if (parsed.kind !== 'kanban_patch' || typeof parsed.targetId !== 'string') {
			return null;
		}
		return {
			...parsed,
			base: normalizeKanbanOverlay(parsed.base),
			next: normalizeKanbanOverlay(parsed.next),
			operations: Array.isArray(parsed.operations) ? parsed.operations : [],
		};
	} catch {
		return null;
	}
}

export function summarizeKanbanPatchChanges(patch: AssistantKanbanPatchArtifact): string[] {
	const changes: string[] = [];
	const baseColumnsById = new Map<string, (typeof patch.base.columns)[number]>(
		patch.base.columns.map((column) => [column.id, column] as const),
	);

	for (const column of patch.next.columns) {
		const previous = baseColumnsById.get(column.id);
		if (!previous) {
			changes.push(`Add column "${column.title}"`);
			continue;
		}

		if (column.title !== previous.title) {
			changes.push(`Rename column "${previous.title}" to "${column.title}"`);
		}

		const previousCardIds = new Set(previous.cards.map((card) => card.id));
		for (const card of column.cards) {
			if (!previousCardIds.has(card.id)) {
				changes.push(`Add card "${card.title}" to "${column.title}"`);
			}
		}
	}

	return changes.length > 0 ? changes : ['Update selected kanban board'];
}

function parseKanbanOpsContent(
	content: string,
): ExtendedKanbanOp[] | KanbanOverlayCustomData | null {
	try {
		const candidate = JSON.parse(content) as
			| ExtendedKanbanOp[]
			| { operations?: ExtendedKanbanOp[] }
			| KanbanOverlayCustomData;
		if (Array.isArray(candidate)) {
			return candidate;
		}

		if (
			candidate &&
			typeof candidate === 'object' &&
			'operations' in candidate &&
			Array.isArray(candidate.operations)
		) {
			return candidate.operations;
		}

		if (
			candidate &&
			typeof candidate === 'object' &&
			'columns' in candidate &&
			Array.isArray((candidate as { columns?: unknown }).columns)
		) {
			return normalizeKanbanOverlay(candidate as KanbanOverlayCustomData);
		}

		return [];
	} catch {
		return null;
	}
}

function getNormalizedColumnFromOp(
	op: ExtendedKanbanOp,
	index: number,
): NormalizedKanbanColumn | null {
	if ('op' in op && op.op === 'add_column') {
		return {
			id: op.column.id,
			title: op.column.title,
			order: index,
			color: op.column.color,
		};
	}

	if ('operation' in op && op.operation === 'add_column') {
		return {
			id: op.id,
			title: op.title,
			order: op.order ?? index,
			color: op.color,
		};
	}

	if ('type' in op && op.type === 'add_column') {
		return {
			id: op.id,
			title: op.title,
			order: op.position ?? index,
			color: op.color,
		};
	}

	return null;
}

function getNormalizedCardFromOp(
	op: ExtendedKanbanOp,
	columns: KanbanColumn[],
	normalizedColumns: NormalizedKanbanColumn[],
): NormalizedKanbanCard | null {
	if ('op' in op && op.op === 'add_card') {
		return {
			id: crypto.randomUUID(),
			columnId: op.columnId,
			title: op.card.title,
			description: op.card.description,
			priority: op.card.priority,
			labels: op.card.labels,
			dueDate: op.card.dueDate,
			checklist: normalizeChecklistItems(op.card.checklist),
		};
	}

	if ('type' in op && op.type === 'add_card') {
		const targetColumn = findColumnByReferenceWithNormalized(
			columns,
			normalizedColumns,
			op.column_id ?? op.column,
		);
		if (!targetColumn) {
			return null;
		}

		return {
			id: op.id ?? crypto.randomUUID(),
			columnId: targetColumn.id,
			title: op.title,
			description: op.description,
			priority: op.priority,
			labels: op.labels,
			dueDate: op.due_date,
			checklist: [],
		};
	}

	if ('operation' in op && op.operation === 'add_card') {
		return {
			id: op.id ?? crypto.randomUUID(),
			columnId: op.column_id,
			title: op.title,
			description: op.description,
			priority: op.priority,
			labels: op.labels,
			dueDate: op.due_date,
			checklist: [],
		};
	}

	return null;
}

function applyUpdatedCard(columns: KanbanColumn[], op: Extract<ExtendedKanbanOp, { op: 'update_card' }>) {
	const column = findColumnByReference(columns, op.columnId ?? op.column);
	const cardIndex = op.cardIndex ?? op.card_index ?? -1;
	if (!column || cardIndex < 0 || cardIndex >= column.cards.length) {
		return;
	}

	const existingCard = column.cards[cardIndex];
	if (!existingCard) {
		return;
	}

	column.cards[cardIndex] = {
		...existingCard,
		...op.updates,
		checklist:
			op.updates?.checklist != null
				? normalizeChecklistItems(op.updates.checklist)
				: normalizeChecklistItems(existingCard.checklist),
	};
}

function applyMovedCard(columns: KanbanColumn[], op: Extract<ExtendedKanbanOp, { op: 'move_card' }>) {
	const fromColumn = findColumnByReference(columns, op.fromColumn ?? op.from_column);
	const toColumn = findColumnByReference(columns, op.toColumn ?? op.to_column);
	const cardIndex = op.cardIndex ?? op.card_index ?? -1;
	const targetIndex = op.targetIndex ?? op.target_index ?? -1;
	if (!fromColumn || !toColumn || cardIndex < 0 || cardIndex >= fromColumn.cards.length) {
		return;
	}

	const [movedCard] = fromColumn.cards.splice(cardIndex, 1);
	if (!movedCard) {
		return;
	}

	if (targetIndex >= 0 && targetIndex <= toColumn.cards.length) {
		toColumn.cards.splice(targetIndex, 0, movedCard);
		return;
	}

	toColumn.cards.push(movedCard);
}

function buildBaseColumns(
	columns: KanbanColumn[],
	normalizedColumns: NormalizedKanbanColumn[],
): KanbanColumn[] {
	if (normalizedColumns.length === 0) {
		return [...columns];
	}

	return normalizedColumns
		.sort((left, right) => left.order - right.order)
		.map<KanbanColumn>((column) => ({
			id: column.id,
			title: column.title,
			color: column.color,
			cards: [],
		}));
}

function appendNormalizedCards(columns: KanbanColumn[], normalizedCards: NormalizedKanbanCard[]) {
	for (const card of normalizedCards) {
		const targetColumn = columns.find((column) => column.id === card.columnId);
		if (!targetColumn) {
			continue;
		}

		targetColumn.cards.push({
			id: card.id,
			title: card.title,
			description: card.description,
			priority: card.priority,
			labels: card.labels,
			dueDate: card.dueDate,
			checklist: normalizeChecklistItems(card.checklist),
		});
	}
}

function buildKanbanBoardFromOps(
	board: KanbanOverlayCustomData,
	ops: ExtendedKanbanOp[],
): KanbanOverlayCustomData {
	const workingBoard = normalizeKanbanOverlay(board);
	const normalizedColumns: NormalizedKanbanColumn[] = [];
	const normalizedCards: NormalizedKanbanCard[] = [];

	for (const [index, op] of ops.entries()) {
		const column = getNormalizedColumnFromOp(op, index);
		if (column) {
			normalizedColumns.push(column);
			continue;
		}

		const card = getNormalizedCardFromOp(op, workingBoard.columns, normalizedColumns);
		if (card) {
			normalizedCards.push(card);
			continue;
		}

		if ('op' in op && op.op === 'update_card') {
			applyUpdatedCard(workingBoard.columns, op);
			continue;
		}

		if ('op' in op && op.op === 'move_card') {
			applyMovedCard(workingBoard.columns, op);
		}
	}

	const baseColumns = buildBaseColumns(workingBoard.columns, normalizedColumns);
	appendNormalizedCards(baseColumns, normalizedCards);

	return normalizeKanbanOverlay({
		...workingBoard,
		title: baseColumns.some((column) => column.title === 'AI Next')
			? 'AI Next Board'
			: workingBoard.title,
		columns: baseColumns,
	});
}

export function buildKanbanFromArtifact(
	artifact: AssistantArtifact,
	baseBoard?: KanbanOverlayCustomData,
): KanbanOverlayCustomData {
	const board = normalizeKanbanOverlay(baseBoard ?? createDefaultKanbanBoard());
	if (artifact.type === 'kanban-patch') {
		return parseKanbanPatchArtifact(artifact)?.next ?? board;
	}

	if (artifact.type !== 'kanban-ops') {
		return board;
	}

	const parsed = parseKanbanOpsContent(artifact.content);
	if (parsed == null) {
		return board;
	}
	if (!Array.isArray(parsed)) {
		return parsed;
	}

	return buildKanbanBoardFromOps(board, parsed);
}
