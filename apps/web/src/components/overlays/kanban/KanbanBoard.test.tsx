import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { KanbanBoard } from './KanbanBoard';
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

function KanbanBoardHarness({ selected }: { selected: boolean }) {
	const [element, setElement] = useState(() => createElement());

	return (
		<KanbanBoard
			element={element}
			mode={selected ? 'live' : 'preview'}
			isSelected={selected}
			onChange={(_elementId, data) =>
				setElement((current) => ({
					...current,
					customData: data,
				}))
			}
		/>
	);
}

describe('KanbanBoard', () => {
	it('keeps preview in sync with live title edits when deselecting without blur', () => {
		const { rerender } = render(<KanbanBoardHarness selected />);

		fireEvent.change(screen.getByDisplayValue('Board'), { target: { value: 'Updated Board' } });
		fireEvent.change(screen.getByDisplayValue('To Do'), { target: { value: 'Doing' } });
		fireEvent.change(screen.getByDisplayValue('Task A'), { target: { value: 'Updated task' } });

		rerender(<KanbanBoardHarness selected={false} />);

		expect(screen.getByText('Updated Board')).not.toBeNull();
		expect(screen.getByText('Doing')).not.toBeNull();
		expect(screen.getByText('Updated task')).not.toBeNull();
	});

	it('shows newly added columns in preview after switching from live mode', () => {
		const { rerender } = render(<KanbanBoardHarness selected />);

		fireEvent.click(screen.getByTitle('Add column'));

		rerender(<KanbanBoardHarness selected={false} />);

		expect(screen.getByText('2 columns')).not.toBeNull();
		expect(screen.getByText(/New column/i)).not.toBeNull();
	});
});
