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

	let parsed: ExtendedKanbanOp[] = [];
	try {
		const candidate = JSON.parse(artifact.content) as
			| ExtendedKanbanOp[]
			| { operations?: ExtendedKanbanOp[] }
			| KanbanOverlayCustomData;
		if (Array.isArray(candidate)) {
			parsed = candidate;
		} else if (
			candidate &&
			typeof candidate === 'object' &&
			'operations' in candidate &&
			Array.isArray(candidate.operations)
		) {
			parsed = candidate.operations;
		} else if (
			candidate &&
			typeof candidate === 'object' &&
			'columns' in candidate &&
			Array.isArray((candidate as { columns?: unknown }).columns)
		) {
			return normalizeKanbanOverlay(candidate as KanbanOverlayCustomData);
		}
	} catch {
		return board;
	}

	const workingBoard = normalizeKanbanOverlay(board);
	const normalizedColumns: NormalizedKanbanColumn[] = [];
	const normalizedCards: NormalizedKanbanCard[] = [];

	for (const [index, op] of parsed.entries()) {
		if ('op' in op && op.op === 'add_column') {
			normalizedColumns.push({
				id: op.column.id,
				title: op.column.title,
				order: index,
				color: op.column.color,
			});
			continue;
		}

		if ('operation' in op && op.operation === 'add_column') {
			normalizedColumns.push({
				id: op.id,
				title: op.title,
				order: op.order ?? index,
				color: op.color,
			});
			continue;
		}

		if ('type' in op && op.type === 'add_column') {
			normalizedColumns.push({
				id: op.id,
				title: op.title,
				order: op.position ?? index,
				color: op.color,
			});
			continue;
		}

		if ('op' in op && op.op === 'add_card') {
			normalizedCards.push({
				id: crypto.randomUUID(),
				columnId: op.columnId,
				title: op.card.title,
				description: op.card.description,
				priority: op.card.priority,
				labels: op.card.labels,
				dueDate: op.card.dueDate,
				checklist: normalizeChecklistItems(op.card.checklist),
			});
			continue;
		}

		if ('type' in op && op.type === 'add_card') {
			const columnRef = op.column_id ?? op.column;
			const targetColumn = findColumnByReferenceWithNormalized(
				workingBoard.columns,
				normalizedColumns,
				columnRef,
			);
			if (!targetColumn) {
				continue;
			}
			normalizedCards.push({
				id: op.id ?? crypto.randomUUID(),
				columnId: targetColumn.id,
				title: op.title,
				description: op.description,
				priority: op.priority,
				labels: op.labels,
				dueDate: op.due_date,
				checklist: [],
			});
			continue;
		}

		if ('operation' in op && op.operation === 'add_card') {
			normalizedCards.push({
				id: op.id ?? crypto.randomUUID(),
				columnId: op.column_id,
				title: op.title,
				description: op.description,
				priority: op.priority,
				labels: op.labels,
				dueDate: op.due_date,
				checklist: [],
			});
			continue;
		}

		if ('op' in op && op.op === 'update_card') {
			const column = findColumnByReference(workingBoard.columns, op.columnId ?? op.column);
			const cardIndex = op.cardIndex ?? op.card_index ?? -1;
			if (!column || cardIndex < 0 || cardIndex >= column.cards.length) {
				continue;
			}
			const existingCard = column.cards[cardIndex];
			if (!existingCard) {
				continue;
			}
			column.cards[cardIndex] = {
				...existingCard,
				...op.updates,
				checklist:
					op.updates?.checklist != null
						? normalizeChecklistItems(op.updates.checklist)
						: normalizeChecklistItems(existingCard.checklist),
			};
			continue;
		}

		if ('op' in op && op.op === 'move_card') {
			const fromColumn = findColumnByReference(
				workingBoard.columns,
				op.fromColumn ?? op.from_column,
			);
			const toColumn = findColumnByReference(workingBoard.columns, op.toColumn ?? op.to_column);
			const cardIndex = op.cardIndex ?? op.card_index ?? -1;
			const targetIndex = op.targetIndex ?? op.target_index ?? -1;
			if (!fromColumn || !toColumn || cardIndex < 0 || cardIndex >= fromColumn.cards.length) {
				continue;
			}
			const [movedCard] = fromColumn.cards.splice(cardIndex, 1);
			if (!movedCard) {
				continue;
			}
			if (targetIndex >= 0 && targetIndex <= toColumn.cards.length) {
				toColumn.cards.splice(targetIndex, 0, movedCard);
			} else {
				toColumn.cards.push(movedCard);
			}
		}
	}

	const baseColumns =
		normalizedColumns.length > 0
			? normalizedColumns
					.sort((left, right) => left.order - right.order)
					.map<KanbanColumn>((column) => ({
						id: column.id,
						title: column.title,
						color: column.color,
						cards: [],
					}))
			: [...workingBoard.columns];

	for (const card of normalizedCards) {
		const targetColumn = baseColumns.find((column) => column.id === card.columnId);
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

	return normalizeKanbanOverlay({
		...workingBoard,
		title: baseColumns.some((column) => column.title === 'AI Next')
			? 'AI Next Board'
			: workingBoard.title,
		columns: baseColumns,
	});
}
