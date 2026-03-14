import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { KanbanElement } from './kanban-board-types';
import { useKanbanBoardState } from './useKanbanBoardState';

function createElement(
	customData: KanbanOverlayCustomData,
	overrides?: Partial<KanbanElement>,
): KanbanElement {
	return {
		id: 'kanban-element',
		width: 600,
		height: 400,
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		opacity: 100,
		roundness: null,
		customData,
		...overrides,
	} as KanbanElement;
}

const baseBoard: KanbanOverlayCustomData = {
	type: 'kanban',
	title: 'Board',
	columns: [
		{
			id: 'todo',
			title: 'To Do',
			cards: [{ id: 'a', title: 'Task A' }],
		},
	],
};

const twocolBoard: KanbanOverlayCustomData = {
	type: 'kanban',
	title: 'Board',
	columns: [
		{
			id: 'todo',
			title: 'To Do',
			cards: [
				{ id: 'a', title: 'Task A' },
				{ id: 'b', title: 'Task B' },
			],
		},
		{
			id: 'done',
			title: 'Done',
			cards: [{ id: 'c', title: 'Task C' }],
		},
	],
};

describe('useKanbanBoardState', () => {
	it('syncs external board updates into local draft state', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: KanbanElement }) =>
				useKanbanBoardState({
					element: props.element,
					isSelected: false,
					onChange,
				}),
			{
				initialProps: {
					element: createElement(baseBoard),
				},
			},
		);

		expect(result.current.board.title).toBe('Board');

		rerender({
			element: createElement({
				...baseBoard,
				title: 'Updated Board',
			}),
		});

		expect(result.current.board.title).toBe('Updated Board');
		expect(result.current.boardTitleDraft).toBe('Updated Board');
	});

	it('adds cards and supports undo/redo through the extracted state actions', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: false,
				onChange,
			}),
		);

		act(() => {
			result.current.handleAddCard('todo');
		});

		expect(result.current.board.columns[0]?.cards).toHaveLength(2);
		expect(result.current.canUndo).toBe(true);
		expect(onChange).toHaveBeenCalled();

		act(() => {
			result.current.handleUndo();
		});

		expect(result.current.board.columns[0]?.cards).toHaveLength(1);
		expect(result.current.canRedo).toBe(true);

		act(() => {
			result.current.handleRedo();
		});

		expect(result.current.board.columns[0]?.cards).toHaveLength(2);
	});

	// --- Edge case tests ---

	it('undo on empty history is a no-op', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: false,
				onChange,
			}),
		);

		expect(result.current.canUndo).toBe(false);

		act(() => {
			result.current.handleUndo();
		});

		expect(result.current.board.title).toBe('Board');
		expect(result.current.board.columns[0]?.cards).toHaveLength(1);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('redo on empty redo stack is a no-op', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: false,
				onChange,
			}),
		);

		expect(result.current.canRedo).toBe(false);

		act(() => {
			result.current.handleRedo();
		});

		expect(result.current.board.columns[0]?.cards).toHaveLength(1);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('redo stack is cleared after a new mutation', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: false,
				onChange,
			}),
		);

		// Add card → undo → we now have a redo entry
		act(() => result.current.handleAddCard('todo'));
		act(() => result.current.handleUndo());
		expect(result.current.canRedo).toBe(true);

		// New mutation should clear redo stack
		act(() => result.current.handleAddColumn());
		expect(result.current.canRedo).toBe(false);
	});

	it('multiple sequential undos walk back through history correctly', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: false,
				onChange,
			}),
		);

		// Make three mutations with history
		act(() => result.current.handleAddCard('todo')); // 2 cards
		act(() => result.current.handleAddCard('todo')); // 3 cards
		act(() => result.current.handleAddColumn()); // 2 columns

		expect(result.current.board.columns).toHaveLength(2);
		expect(result.current.board.columns[0]?.cards).toHaveLength(3);

		// Undo all three
		act(() => result.current.handleUndo()); // back to 1 column, 3 cards
		expect(result.current.board.columns).toHaveLength(1);
		expect(result.current.board.columns[0]?.cards).toHaveLength(3);

		act(() => result.current.handleUndo()); // back to 2 cards
		expect(result.current.board.columns[0]?.cards).toHaveLength(2);

		act(() => result.current.handleUndo()); // back to 1 card
		expect(result.current.board.columns[0]?.cards).toHaveLength(1);

		// No more history
		expect(result.current.canUndo).toBe(false);

		// Redo all three
		act(() => result.current.handleRedo());
		expect(result.current.board.columns[0]?.cards).toHaveLength(2);

		act(() => result.current.handleRedo());
		expect(result.current.board.columns[0]?.cards).toHaveLength(3);

		act(() => result.current.handleRedo());
		expect(result.current.board.columns).toHaveLength(2);

		expect(result.current.canRedo).toBe(false);
	});

	it('non-history mutations do not push onto undo stack', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: false,
				onChange,
			}),
		);

		// handleColumnChange uses history: false
		act(() => {
			result.current.handleColumnChange('todo', { title: 'Renamed' });
		});

		expect(result.current.board.columns[0]?.title).toBe('Renamed');
		expect(result.current.canUndo).toBe(false);
	});

	it('ignores external update when serialized board has not changed', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: KanbanElement }) =>
				useKanbanBoardState({
					element: props.element,
					isSelected: false,
					onChange,
				}),
			{
				initialProps: {
					element: createElement(baseBoard),
				},
			},
		);

		const boardBefore = result.current.board;

		// Re-render with structurally identical data (different object reference)
		rerender({
			element: createElement({ ...baseBoard }),
		});

		// Board reference should not change because serialization is the same
		expect(result.current.board).toBe(boardBefore);
	});

	it('resets undo/redo stacks when element id changes', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: KanbanElement }) =>
				useKanbanBoardState({
					element: props.element,
					isSelected: false,
					onChange,
				}),
			{
				initialProps: {
					element: createElement(baseBoard),
				},
			},
		);

		// Build some history
		act(() => result.current.handleAddCard('todo'));
		expect(result.current.canUndo).toBe(true);

		// Switch to a different element — stacks are cleared via ref
		rerender({
			element: createElement(baseBoard, { id: 'different-element' } as Partial<KanbanElement>),
		});

		// canUndo/canRedo are ref-derived, so force a render to pick up cleared stacks
		act(() => {
			result.current.handleAddCard('todo');
		});
		act(() => {
			result.current.handleUndo();
		});

		// Only one undo was possible (the addCard above), not the one from before the element switch
		expect(result.current.canUndo).toBe(false);
	});

	it('commitBoardTitle reverts to current title when draft is empty', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.setBoardTitleDraft('   ');
		});

		act(() => {
			result.current.commitBoardTitle();
		});

		// Should revert to the board title, not persist whitespace
		expect(result.current.boardTitleDraft).toBe('Board');
		expect(onChange).not.toHaveBeenCalled();
	});

	it('commitBoardTitle is a no-op when draft matches current title', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.commitBoardTitle();
		});

		expect(onChange).not.toHaveBeenCalled();
	});

	it('delete card pushes to undo history', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(twocolBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.handleDeleteCard('todo', 'a');
		});

		expect(result.current.board.columns[0]?.cards).toHaveLength(1);
		expect(result.current.board.columns[0]?.cards[0]?.id).toBe('b');
		expect(result.current.canUndo).toBe(true);

		// Undo should restore the deleted card
		act(() => result.current.handleUndo());
		expect(result.current.board.columns[0]?.cards).toHaveLength(2);
		expect(result.current.board.columns[0]?.cards[0]?.id).toBe('a');
	});

	it('handleDeletePendingColumn removes the column and clears pending state', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(twocolBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.handleRequestDeleteColumn('done'));
		expect(result.current.pendingDeleteColumnId).toBe('done');
		expect(result.current.pendingDeleteColumn?.title).toBe('Done');

		act(() => result.current.handleDeletePendingColumn());
		expect(result.current.board.columns).toHaveLength(1);
		expect(result.current.pendingDeleteColumnId).toBeNull();
		expect(result.current.pendingDeleteColumn).toBeNull();
		expect(result.current.canUndo).toBe(true);
	});

	it('handleDeletePendingColumn is a no-op when no column is pending', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.handleDeletePendingColumn());

		expect(result.current.board.columns).toHaveLength(1);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('clears pendingDeleteColumnId when the column is removed externally', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: KanbanElement }) =>
				useKanbanBoardState({
					element: props.element,
					isSelected: true,
					onChange,
				}),
			{
				initialProps: {
					element: createElement(twocolBoard),
				},
			},
		);

		act(() => result.current.handleRequestDeleteColumn('done'));
		expect(result.current.pendingDeleteColumnId).toBe('done');

		// External update removes the 'done' column
		rerender({
			element: createElement({
				...twocolBoard,
				columns: twocolBoard.columns.filter((c) => c.id !== 'done'),
			}),
		});

		expect(result.current.pendingDeleteColumnId).toBeNull();
	});

	it('handleResetBoard replaces columns with starter columns and supports undo', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(twocolBoard),
				isSelected: true,
				onChange,
			}),
		);

		const originalColumns = result.current.board.columns;
		act(() => result.current.handleResetBoard());

		// Should have starter columns, not the original ones
		expect(result.current.board.columns).not.toEqual(originalColumns);
		expect(result.current.canUndo).toBe(true);

		// Undo should restore original columns
		act(() => result.current.handleUndo());
		expect(result.current.board.columns).toHaveLength(originalColumns.length);
		expect(result.current.board.columns[0]?.id).toBe('todo');
	});

	it('handleEscapeKey clears search query and dismisses panels', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.setSearchQuery('test');
			result.current.setShowSettings(true);
			result.current.setPendingDeleteColumnId('todo');
		});

		act(() => result.current.handleEscapeKey());

		expect(result.current.searchQuery).toBe('');
		expect(result.current.showSettings).toBe(false);
		expect(result.current.pendingDeleteColumnId).toBeNull();
	});

	it('deselecting clears settings panel and pending delete', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useKanbanBoardState({
					element: createElement(baseBoard),
					isSelected: props.isSelected,
					onChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		act(() => {
			result.current.setShowSettings(true);
			result.current.setPendingDeleteColumnId('todo');
		});

		rerender({ isSelected: false });

		expect(result.current.showSettings).toBe(false);
		expect(result.current.pendingDeleteColumnId).toBeNull();
	});

	it('reports editing lifecycle on selection changes', () => {
		const onChange = vi.fn();
		const onEditingChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useKanbanBoardState({
					element: createElement(baseBoard),
					isSelected: props.isSelected,
					onChange,
					onEditingChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		expect(onEditingChange).toHaveBeenLastCalledWith(true);

		rerender({ isSelected: false });
		expect(onEditingChange).toHaveBeenLastCalledWith(false);
	});

	it('does not re-report the same editing state', () => {
		const onChange = vi.fn();
		const onEditingChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useKanbanBoardState({
					element: createElement(baseBoard),
					isSelected: props.isSelected,
					onChange,
					onEditingChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		const callCount = onEditingChange.mock.calls.length;

		// Re-render with same selection state
		rerender({ isSelected: true });
		expect(onEditingChange.mock.calls.length).toBe(callCount);
	});

	it('handleAdjustFontSize clamps correctly from default', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.handleAdjustFontSize(2));
		expect(result.current.board.fontSize).toBe(16);
		expect(result.current.canUndo).toBe(true);

		act(() => result.current.handleAdjustFontSize(-4));
		expect(result.current.board.fontSize).toBe(12);
	});

	it('updateBoard is a no-op when updater returns the same reference', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useKanbanBoardState({
				element: createElement(baseBoard),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.updateBoard((board) => board, { history: true });
		});

		expect(onChange).not.toHaveBeenCalled();
		expect(result.current.canUndo).toBe(false);
	});
});
