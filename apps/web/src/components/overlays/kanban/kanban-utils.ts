import { createStarterKanbanColumns as createSharedStarterKanbanColumns, normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type { KanbanColumn, KanbanOverlayCustomData } from '@ai-canvas/shared/types';

const MAX_HISTORY_ENTRIES = 100;

interface CardWithId {
	id: string;
}

interface ColumnWithId {
	id: string;
}

export function createStarterKanbanColumns(): KanbanColumn[] {
	return createSharedStarterKanbanColumns();
}

export function cloneKanbanBoard(board: KanbanOverlayCustomData): KanbanOverlayCustomData {
	if (typeof structuredClone === 'function') {
		return structuredClone(board);
	}
	return JSON.parse(JSON.stringify(board)) as KanbanOverlayCustomData;
}

export function normalizeKanbanBoard(board: Partial<KanbanOverlayCustomData> | null | undefined): KanbanOverlayCustomData {
	return normalizeKanbanOverlay(board);
}

export function getProjectedOverCardId(
	cards: ReadonlyArray<CardWithId>,
	hoveredCardId: string,
	isPastMidpoint: boolean,
	previousProjectedCardId?: string | null,
	pointerRatioWithinCard?: number,
): string | null {
	const hoveredIndex = cards.findIndex((card) => card.id === hoveredCardId);
	if (hoveredIndex === -1) return null;

	const nextCardId = cards[hoveredIndex + 1]?.id ?? null;
	if (typeof pointerRatioWithinCard !== 'number') {
		if (!isPastMidpoint) return hoveredCardId;
		return nextCardId;
	}

	const normalizedRatio = Math.min(1, Math.max(0, pointerRatioWithinCard));
	const deadZone = 0.14;

	if (previousProjectedCardId === hoveredCardId && normalizedRatio < 0.5 + deadZone) {
		return hoveredCardId;
	}

	if (previousProjectedCardId === nextCardId && normalizedRatio > 0.5 - deadZone) {
		return nextCardId;
	}

	if (!isPastMidpoint) return hoveredCardId;
	return nextCardId;
}

export function getProjectedOverColumnId(
	columns: ReadonlyArray<ColumnWithId>,
	hoveredColumnId: string,
	isPastMidpoint: boolean,
): string | null {
	const hoveredIndex = columns.findIndex((column) => column.id === hoveredColumnId);
	if (hoveredIndex === -1) return null;
	if (!isPastMidpoint) return hoveredColumnId;
	return columns[hoveredIndex + 1]?.id ?? null;
}

export function moveKanbanCard(
	board: KanbanOverlayCustomData,
	cardId: string,
	toColumnId: string,
	overCardId?: string | null,
): KanbanOverlayCustomData {
	const fromColumn = board.columns.find((column) => column.cards.some((card) => card.id === cardId));
	if (!fromColumn) return board;

	const sourceCardIndex = fromColumn.cards.findIndex((card) => card.id === cardId);
	if (sourceCardIndex === -1) return board;

	const movingCard = fromColumn.cards[sourceCardIndex];
	if (!movingCard) return board;

	if (fromColumn.id === toColumnId) {
		if (overCardId === cardId) return board;

		const cardsWithoutMoving = fromColumn.cards.filter((card) => card.id !== cardId);
		let nextIndex = cardsWithoutMoving.length;

		if (overCardId) {
			const targetIndex = cardsWithoutMoving.findIndex((card) => card.id === overCardId);
			if (targetIndex === -1) return board;
			nextIndex = targetIndex;
		}

		const nextCards = [...cardsWithoutMoving];
		nextCards.splice(nextIndex, 0, movingCard);

		const isUnchanged = nextCards.every((card, index) => card.id === fromColumn.cards[index]?.id);
		if (isUnchanged) return board;

		return {
			...board,
			columns: board.columns.map((column) =>
				column.id === fromColumn.id ? { ...column, cards: nextCards } : column,
			),
		};
	}

	const toColumn = board.columns.find((column) => column.id === toColumnId);
	if (!toColumn) return board;

	const nextColumns = board.columns.map((column) => ({ ...column, cards: [...column.cards] }));
	const source = nextColumns.find((column) => column.id === fromColumn.id);
	const destination = nextColumns.find((column) => column.id === toColumnId);
	if (!source || !destination) return board;

	const removalIndex = source.cards.findIndex((card) => card.id === cardId);
	if (removalIndex === -1) return board;

	const [removedCard] = source.cards.splice(removalIndex, 1);
	if (!removedCard) return board;

	const insertionIndex = overCardId
		? destination.cards.findIndex((card) => card.id === overCardId)
		: -1;

	if (insertionIndex === -1) {
		destination.cards.push(removedCard);
	} else {
		destination.cards.splice(insertionIndex, 0, removedCard);
	}

	return {
		...board,
		columns: nextColumns,
	};
}

export function moveKanbanColumn(
	board: KanbanOverlayCustomData,
	columnId: string,
	overColumnId?: string | null,
): KanbanOverlayCustomData {
	const sourceIndex = board.columns.findIndex((column) => column.id === columnId);
	if (sourceIndex === -1) return board;

	if (overColumnId === columnId) return board;

	const remainingColumns = board.columns.filter((column) => column.id !== columnId);
	let nextIndex = remainingColumns.length;

	if (overColumnId) {
		const targetIndex = remainingColumns.findIndex((column) => column.id === overColumnId);
		if (targetIndex === -1) return board;
		nextIndex = targetIndex;
	}

	const movingColumn = board.columns[sourceIndex];
	if (!movingColumn) return board;

	const nextColumns = [...remainingColumns];
	nextColumns.splice(nextIndex, 0, movingColumn);

	const isUnchanged = nextColumns.every((column, index) => column.id === board.columns[index]?.id);
	if (isUnchanged) return board;

	return {
		...board,
		columns: nextColumns,
	};
}

export function pushKanbanHistory(
	history: KanbanOverlayCustomData[],
	board: KanbanOverlayCustomData,
): KanbanOverlayCustomData[] {
	return [...history.slice(-(MAX_HISTORY_ENTRIES - 1)), cloneKanbanBoard(board)];
}
