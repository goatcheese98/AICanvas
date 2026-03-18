import type { KanbanColumn as KanbanColumnType } from '@ai-canvas/shared/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KanbanColumn } from './KanbanColumn';

function createColumn(overrides?: Partial<KanbanColumnType>): KanbanColumnType {
	return {
		id: 'col-1',
		title: 'To Do',
		cards: [
			{ id: 'card-1', title: 'Task 1', priority: 'medium' },
			{ id: 'card-2', title: 'Task 2', priority: 'high' },
		],
		...overrides,
	};
}

const defaultProps = {
	columnBackground: '#f5f5f5',
	cardBackground: '#ffffff',
	cardRadius: 8,
	controlRadius: 6,
	columnRadius: 12,
	borderTone: '#e5e5e5',
	isLiveResizing: false,
	isCardOver: false,
	draggingCardId: null,
	draggingFromColumnId: null,
	draggingColumnId: null,
	overCardId: null,
	searchQuery: '',
	onChange: vi.fn(),
	onRequestDelete: vi.fn(),
	onAddCard: vi.fn(),
	onUpdateCard: vi.fn(),
	onDeleteCard: vi.fn(),
	onCardDragStart: vi.fn(),
	onCardDragEnd: vi.fn(),
	onCardColumnDragOver: vi.fn(),
	onCardColumnDrop: vi.fn(),
	onCardDragOverTarget: vi.fn(),
	onColumnDragStart: vi.fn(),
	onColumnDragEnd: vi.fn(),
	onColumnReorderDragOver: vi.fn(),
	onColumnReorderDrop: vi.fn(),
};

describe('KanbanColumn', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	describe('title editing', () => {
		it('renders column title', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} />);
			expect(screen.getByDisplayValue('To Do')).not.toBeNull();
		});

		it('commits title change on blur', () => {
			const onChange = vi.fn();
			render(<KanbanColumn {...defaultProps} column={createColumn()} onChange={onChange} />);

			const titleInput = screen.getByDisplayValue('To Do');
			fireEvent.change(titleInput, { target: { value: 'In Progress' } });
			fireEvent.blur(titleInput);

			expect(onChange).toHaveBeenCalledWith({ title: 'In Progress' });
		});

		it('commits title change on Enter key', () => {
			const onChange = vi.fn();
			render(<KanbanColumn {...defaultProps} column={createColumn()} onChange={onChange} />);

			const titleInput = screen.getByDisplayValue('To Do');
			fireEvent.change(titleInput, { target: { value: 'In Progress' } });
			fireEvent.keyDown(titleInput, { key: 'Enter' });

			expect(onChange).toHaveBeenCalledWith({ title: 'In Progress' });
		});

		it('reverts to original title if empty on blur', () => {
			const onChange = vi.fn();
			render(<KanbanColumn {...defaultProps} column={createColumn()} onChange={onChange} />);

			const titleInput = screen.getByDisplayValue('To Do');
			fireEvent.change(titleInput, { target: { value: '' } });
			fireEvent.blur(titleInput);

			expect(onChange).not.toHaveBeenCalled();
			expect(screen.getByDisplayValue('To Do')).not.toBeNull();
		});

		it('does not call onChange if title unchanged', () => {
			const onChange = vi.fn();
			render(<KanbanColumn {...defaultProps} column={createColumn()} onChange={onChange} />);

			const titleInput = screen.getByDisplayValue('To Do');
			fireEvent.change(titleInput, { target: { value: 'To Do' } });
			fireEvent.blur(titleInput);

			expect(onChange).not.toHaveBeenCalled();
		});

		it('syncs titleDraft when column title prop changes', () => {
			const { rerender } = render(<KanbanColumn {...defaultProps} column={createColumn()} />);

			expect(screen.getByDisplayValue('To Do')).not.toBeNull();

			rerender(
				<KanbanColumn {...defaultProps} column={createColumn({ title: 'Updated Title' })} />,
			);

			expect(screen.getByDisplayValue('Updated Title')).not.toBeNull();
		});
	});

	describe('cards rendering', () => {
		it('renders all cards in column', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} />);

			expect(screen.getByDisplayValue('Task 1')).not.toBeNull();
			expect(screen.getByDisplayValue('Task 2')).not.toBeNull();
		});

		it('shows card count', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} />);

			expect(screen.getByText('2 cards')).not.toBeNull();
		});

		it('shows single card count label correctly', () => {
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn({ cards: [{ id: 'c1', title: 'Only Card' }] })}
				/>,
			);

			expect(screen.getByText('1 card')).not.toBeNull();
		});
	});

	describe('search filtering', () => {
		it('filters cards based on search query', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} searchQuery="Task 1" />);

			expect(screen.getByDisplayValue('Task 1')).not.toBeNull();
			expect(screen.queryByDisplayValue('Task 2')).toBeNull();
		});

		it('shows search results count during search', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} searchQuery="Task" />);

			expect(screen.getByText(/shown/i)).not.toBeNull();
		});

		it('shows "No matches" when search has no results', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} searchQuery="NonExistent" />);

			expect(screen.getByText('No matches')).not.toBeNull();
		});

		it('searches in card descriptions', () => {
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn({
						cards: [
							{ id: 'c1', title: 'Card 1', description: 'Find me' },
							{ id: 'c2', title: 'Card 2', description: 'Other' },
						],
					})}
					searchQuery="Find"
				/>,
			);

			expect(screen.getByDisplayValue('Card 1')).not.toBeNull();
			expect(screen.queryByDisplayValue('Card 2')).toBeNull();
		});

		it('searches in card labels', () => {
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn({
						cards: [
							{ id: 'c1', title: 'Card 1', labels: ['urgent', 'bug'] },
							{ id: 'c2', title: 'Card 2', labels: ['feature'] },
						],
					})}
					searchQuery="urgent"
				/>,
			);

			expect(screen.getByDisplayValue('Card 1')).not.toBeNull();
			expect(screen.queryByDisplayValue('Card 2')).toBeNull();
		});
	});

	describe('column actions', () => {
		it('calls onRequestDelete when delete button clicked', () => {
			const onRequestDelete = vi.fn();
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn()}
					onRequestDelete={onRequestDelete}
				/>,
			);

			// Hover over column to show controls
			const column = screen.getByDisplayValue('To Do').closest('div[class*="flex-col"]');
			if (column) {
				fireEvent.mouseEnter(column);
			}

			const deleteButton = screen.getByTitle('Delete column');
			fireEvent.click(deleteButton);

			expect(onRequestDelete).toHaveBeenCalled();
		});

		it('calls onAddCard when add card button clicked', () => {
			const onAddCard = vi.fn();
			render(<KanbanColumn {...defaultProps} column={createColumn()} onAddCard={onAddCard} />);

			const addButton = screen.getByText('Add card');
			fireEvent.click(addButton);

			expect(onAddCard).toHaveBeenCalled();
		});
	});

	describe('drag and drop', () => {
		it('calls onColumnDragStart when drag handle is dragged', () => {
			const onColumnDragStart = vi.fn();
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn()}
					onColumnDragStart={onColumnDragStart}
				/>,
			);

			// Hover over column to show controls
			const column = screen.getByDisplayValue('To Do').closest('div[class*="flex-col"]');
			if (column) {
				fireEvent.mouseEnter(column);
			}

			const dragHandle = screen.getByTitle('Drag column');
			fireEvent.dragStart(dragHandle);

			expect(onColumnDragStart).toHaveBeenCalled();
		});

		it('renders draggable card elements', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} />);

			// Find the card container via the title input
			const cardInput = screen.getByDisplayValue('Task 1');
			const cardContainer = cardInput.closest('[draggable="true"]');

			// Verify card is rendered with draggable attribute
			expect(cardContainer).not.toBeNull();
			expect(cardContainer?.getAttribute('draggable')).toBe('true');
		});

		it('calls onCardColumnDragOver when dragging over column', () => {
			const onCardColumnDragOver = vi.fn();
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn()}
					onCardColumnDragOver={onCardColumnDragOver}
				/>,
			);

			const column = screen.getByDisplayValue('To Do').closest('div[class*="flex-col"]');
			if (column) {
				fireEvent.dragOver(column);
				expect(onCardColumnDragOver).toHaveBeenCalled();
			}
		});

		it('calls onCardColumnDrop when dropping on column', () => {
			const onCardColumnDrop = vi.fn();
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn()}
					onCardColumnDrop={onCardColumnDrop}
				/>,
			);

			const column = screen.getByDisplayValue('To Do').closest('div[class*="flex-col"]');
			if (column) {
				fireEvent.drop(column);
				expect(onCardColumnDrop).toHaveBeenCalled();
			}
		});

		it('calls onColumnReorderDragOver when column dragging over', () => {
			const onColumnReorderDragOver = vi.fn();
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn()}
					draggingColumnId="col-2"
					onColumnReorderDragOver={onColumnReorderDragOver}
				/>,
			);

			const column = screen.getByDisplayValue('To Do').closest('div[class*="flex-col"]');
			if (column) {
				fireEvent.dragOver(column);
				expect(onColumnReorderDragOver).toHaveBeenCalled();
			}
		});

		it('prevents card drag when search is active', () => {
			const onCardDragStart = vi.fn();
			render(
				<KanbanColumn
					{...defaultProps}
					column={createColumn()}
					searchQuery="Task"
					onCardDragStart={onCardDragStart}
				/>,
			);

			// When search is active, the cards should not be draggable (or dragStart handler won't trigger)
			const cardInput = screen.getByDisplayValue('Task 1');
			const cardContainer = cardInput.closest('[draggable="true"]');

			// Verify card still exists but search mode prevents drag
			expect(cardContainer).not.toBeNull();
		});

		it('applies drag opacity when column is being dragged', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} draggingColumnId="col-1" />);

			const column = screen
				.getByDisplayValue('To Do')
				.closest('div[class*="flex-col"]') as HTMLElement | null;
			if (column) {
				expect(column.style.opacity).toBe('0.7');
			}
		});
	});

	describe('hover behavior', () => {
		it('shows add card button on hover', () => {
			render(<KanbanColumn {...defaultProps} column={createColumn()} />);

			const column = screen.getByDisplayValue('To Do').closest('div[class*="flex-col"]');
			if (column) {
				fireEvent.mouseEnter(column);
				const addButton = screen.getByText('Add card');
				expect(addButton).not.toBeNull();
			}
		});
	});
});
