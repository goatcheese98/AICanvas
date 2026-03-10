import { describe, expect, it } from 'vitest';
import { moveKanbanCard, normalizeKanbanBoard, pushKanbanHistory } from './kanban-utils';
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
});
