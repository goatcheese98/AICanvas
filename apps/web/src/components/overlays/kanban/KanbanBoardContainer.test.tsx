import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KanbanBoardContainer } from './KanbanBoardContainer';
import type { KanbanBoardProps } from './kanban-board-types';

function createElement(customData?: Partial<KanbanOverlayCustomData>): KanbanBoardProps['element'] {
	return {
		id: 'kanban-element',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 960,
		height: 640,
		angle: 0,
		backgroundColor: '#ffffff',
		strokeColor: '#111827',
		strokeWidth: 1,
		strokeStyle: 'solid',
		fillStyle: 'solid',
		roughness: 0,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		seed: 1,
		index: 'a0' as never,
		customData: {
			type: 'kanban',
			title: 'Board',
			columns: [
				{
					id: 'todo',
					title: 'To Do',
					cards: [{ id: 'card-a', title: 'Task A' }],
				},
			],
			...customData,
		},
	} as KanbanBoardProps['element'];
}

describe('KanbanBoardContainer', () => {
	afterEach(() => {
		cleanup();
	});

	it('persists board title changes and add-card actions through the container boundary', () => {
		const onChange = vi.fn();

		render(<KanbanBoardContainer element={createElement()} isSelected onChange={onChange} />);

		const boardTitleInput = screen.getByDisplayValue('Board');
		fireEvent.change(boardTitleInput, { target: { value: 'Updated Board' } });
		fireEvent.blur(boardTitleInput);

		expect(onChange).toHaveBeenCalledWith(
			'kanban-element',
			expect.objectContaining({
				title: 'Updated Board',
			}),
		);

		fireEvent.click(screen.getByRole('button', { name: /add card/i }));

		expect(onChange).toHaveBeenLastCalledWith(
			'kanban-element',
			expect.objectContaining({
				columns: [
					expect.objectContaining({
						id: 'todo',
						cards: expect.arrayContaining([
							expect.objectContaining({ id: 'card-a', title: 'Task A' }),
						]),
					}),
				],
			}),
		);
		expect((onChange.mock.lastCall?.[1] as KanbanOverlayCustomData).columns[0]?.cards).toHaveLength(
			2,
		);
	});

	it('opens board settings from the header and dismisses them on escape', () => {
		render(<KanbanBoardContainer element={createElement()} isSelected onChange={vi.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: 'Board appearance' }));
		expect(screen.getByText('Reset board')).not.toBeNull();

		fireEvent.keyDown(window, { key: 'Escape' });
		expect(screen.queryByText('Reset board')).toBeNull();
	});
});
