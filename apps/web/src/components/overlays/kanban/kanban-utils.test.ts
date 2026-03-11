import { describe, expect, it } from 'vitest';
import {
	createStarterKanbanColumns,
	getProjectedOverCardId,
	getProjectedOverColumnId,
	moveKanbanCard,
	moveKanbanColumn,
	normalizeKanbanBoard,
	pushKanbanHistory,
} from './kanban-utils';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';

const board: KanbanOverlayCustomData = {
	type: 'kanban',
	title: 'Board',
	columns: [
		{
			id: 'todo',
			title: 'To Do',
			cards: [{ id: 'a', title: 'Task A' }, { id: 'b', title: 'Task B' }],
		},
		{
			id: 'done',
			title: 'Done',
			cards: [{ id: 'c', title: 'Task C' }],
		},
	],
};

describe('kanban-utils', () => {
	it('moves cards between columns while preserving card data', () => {
		const next = moveKanbanCard(board, 'a', 'done');

		expect(next.columns[0]?.cards.map((card) => card.id)).toEqual(['b']);
		expect(next.columns[1]?.cards.map((card) => card.id)).toEqual(['c', 'a']);
	});

	it('inserts cards before a target card when provided', () => {
		const next = moveKanbanCard(board, 'b', 'done', 'c');

		expect(next.columns[1]?.cards.map((card) => card.id)).toEqual(['b', 'c']);
	});

	it('reorders cards within the same column using projected positions', () => {
		const next = moveKanbanCard(board, 'b', 'todo', 'a');

		expect(next.columns[0]?.cards.map((card) => card.id)).toEqual(['b', 'a']);

		const reordered = moveKanbanCard(board, 'a', 'todo', null);
		expect(reordered.columns[0]?.cards.map((card) => card.id)).toEqual(['b', 'a']);
	});

	it('returns the same board for same-position drops', () => {
		expect(moveKanbanCard(board, 'a', 'todo', 'a')).toBe(board);
	});

	it('stores cloned snapshots in history', () => {
		const history = pushKanbanHistory([], board);
		board.columns[0]!.title = 'Mutated';

		expect(history).toHaveLength(1);
		expect(history[0]?.columns[0]?.title).toBe('To Do');
	});

	it('normalizes partial board payloads into safe arrays', () => {
		const normalized = normalizeKanbanBoard({
			type: 'kanban',
			title: 'Board',
			columns: [{ id: 'todo', title: 'Todo' } as any],
		});

		expect(normalized.columns).toHaveLength(1);
		expect(normalized.columns[0]?.cards).toEqual([]);
		expect(normalized.fontId).toBeUndefined();
		expect(normalized.fontSize).toBeUndefined();
	});

	it('clamps font size during normalization', () => {
		const normalized = normalizeKanbanBoard({
			type: 'kanban',
			title: 'Board',
			fontSize: 100,
			columns: [],
		});

		expect(normalized.fontSize).toBe(18);
	});

	it('projects the next insertion point when the cursor passes a card midpoint', () => {
		expect(getProjectedOverCardId(board.columns[0]?.cards ?? [], 'a', false)).toBe('a');
		expect(getProjectedOverCardId(board.columns[0]?.cards ?? [], 'a', true)).toBe('b');
		expect(getProjectedOverCardId(board.columns[0]?.cards ?? [], 'b', true)).toBeNull();
	});

	it('moves columns before a projected target', () => {
		const next = moveKanbanColumn(board, 'done', 'todo');
		expect(next.columns.map((column) => column.id)).toEqual(['done', 'todo']);
	});

	it('projects the next column insertion point after midpoint', () => {
		expect(getProjectedOverColumnId(board.columns, 'todo', false)).toBe('todo');
		expect(getProjectedOverColumnId(board.columns, 'todo', true)).toBe('done');
		expect(getProjectedOverColumnId(board.columns, 'done', true)).toBeNull();
	});

	it('creates a non-empty starter template', () => {
		const columns = createStarterKanbanColumns();
		expect(columns).toHaveLength(3);
		expect(columns.some((column) => column.cards.length > 0)).toBe(true);
	});
});
