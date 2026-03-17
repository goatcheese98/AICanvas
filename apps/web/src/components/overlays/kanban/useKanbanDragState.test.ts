import { describe, expect, it } from 'vitest';
import { type DragState, dragReducer } from './useKanbanDragState';

describe('dragReducer', () => {
	it('tracks delete targeting for card drags without losing the active card', () => {
		const started = dragReducer(
			{ mode: 'idle' },
			{ type: 'CARD_START', cardId: 'card-1', fromColumnId: 'todo' },
		);
		const targeted = dragReducer(started, { type: 'CARD_DELETE_TARGET' });

		expect(targeted).toEqual({
			mode: 'card',
			cardId: 'card-1',
			fromColumnId: 'todo',
			overColumnId: null,
			overCardId: null,
			isDeleteTargeted: true,
		} satisfies DragState);
	});

	it('keeps projected column drop ids in column drag mode', () => {
		const started = dragReducer({ mode: 'idle' }, { type: 'COLUMN_START', columnId: 'done' });
		const projected = dragReducer(started, { type: 'COLUMN_OVER', projectedDropId: 'todo' });

		expect(projected).toEqual({
			mode: 'column',
			columnId: 'done',
			projectedDropId: 'todo',
		} satisfies DragState);
	});
});
