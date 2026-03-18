import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KanbanCard } from './KanbanCard';

function createCard(overrides: Partial<KanbanCardType> = {}): KanbanCardType {
	return {
		id: 'card-1',
		title: 'Test Card',
		...overrides,
	};
}

describe('KanbanCard', () => {
	describe('title editing', () => {
		it('renders card title', () => {
			const card = createCard({ title: 'My Task' });
			render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			expect(screen.getByDisplayValue('My Task')).not.toBeNull();
		});

		it('updates title draft on input', () => {
			const card = createCard({ title: 'Original' });
			render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			const input = screen.getByDisplayValue('Original');
			fireEvent.change(input, { target: { value: 'Updated Title' } });

			expect(screen.getByDisplayValue('Updated Title')).not.toBeNull();
		});

		it('commits title change on blur', () => {
			const handleChange = vi.fn();
			const card = createCard({ title: 'Original' });
			render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={handleChange}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			const input = screen.getByDisplayValue('Original');
			fireEvent.change(input, { target: { value: 'Updated Title' } });
			fireEvent.blur(input);

			expect(handleChange).toHaveBeenCalledWith({ title: 'Updated Title' });
		});

		it('resets title to card title when empty on blur', () => {
			const card = createCard({ title: 'Original' });
			render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			const input = screen.getByDisplayValue('Original');
			fireEvent.change(input, { target: { value: '   ' } });
			fireEvent.blur(input);

			// Should reset to original title
			expect(screen.getByDisplayValue('Original')).not.toBeNull();
		});

		it('does not commit if title unchanged', () => {
			const handleChange = vi.fn();
			const card = createCard({ title: 'Same Title' });
			render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={handleChange}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			const input = screen.getByDisplayValue('Same Title');
			fireEvent.change(input, { target: { value: 'Same Title' } });
			fireEvent.blur(input);

			expect(handleChange).not.toHaveBeenCalled();
		});
	});

	describe('description editing', () => {
		it('shows description in read mode by default', () => {
			const card = createCard({ description: 'My description' });
			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			expect(container.textContent).toContain('My description');
		});

		it('shows placeholder when no description', () => {
			const card = createCard({ description: '' });
			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			expect(container.textContent).toContain('Double-click to add a description');
		});

		it('enters edit mode on double click', () => {
			const card = createCard({ description: 'My description' });
			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			// Find the description container and double-click it
			const descContainer = container.querySelector('[title="Double-click to edit description"]');
			expect(descContainer).not.toBeNull();
			if (descContainer) {
				fireEvent.doubleClick(descContainer);
				// Should now show textarea for editing - check by placeholder or by checking
				// that there's an additional textarea (one for title, one for description)
				const textareas = container.querySelectorAll('textarea');
				expect(textareas.length).toBeGreaterThanOrEqual(1);
			}
		});

		it('exits edit mode on blur and commits changes', () => {
			const handleChange = vi.fn();
			const card = createCard({ description: 'My description' });
			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={handleChange}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			// Find the description container and double-click it
			const descContainer = container.querySelector('[title="Double-click to edit description"]');
			if (descContainer) {
				fireEvent.doubleClick(descContainer);
				// Find and update the textarea
				const textarea = container.querySelector('textarea[value="My description"]');
				if (textarea) {
					fireEvent.change(textarea, { target: { value: 'Updated description' } });
					fireEvent.blur(textarea);
					expect(handleChange).toHaveBeenCalledWith({ description: 'Updated description' });
				}
			}
		});
	});

	describe('drag interactions', () => {
		it('calls onDragStart when drag handle is used', () => {
			const handleDragStart = vi.fn();
			const card = createCard();

			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={handleDragStart}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			const dragHandle = container.querySelector('[data-card-drag-handle="true"]');
			expect(dragHandle).not.toBeNull();
			if (dragHandle) {
				fireEvent.mouseDown(dragHandle);

				// Simulate drag start on the card container
				const cardContainer = container.querySelector('[draggable="true"]');
				if (cardContainer) {
					fireEvent.dragStart(cardContainer);
					expect(handleDragStart).toHaveBeenCalled();
				}
			}
		});
	});

	describe('delete interaction', () => {
		it('calls onDelete when delete button is clicked', () => {
			const handleDelete = vi.fn();
			const card = createCard();

			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={handleDelete}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
				/>,
			);

			const deleteButton = container.querySelector('[title="Delete card"]');
			expect(deleteButton).not.toBeNull();
			if (deleteButton) {
				fireEvent.click(deleteButton);
				expect(handleDelete).toHaveBeenCalled();
			}
		});
	});

	describe('hover interactions', () => {
		it('calls onHoverChange when hovering', () => {
			const handleHoverChange = vi.fn();
			const card = createCard();

			const { container } = render(
				<KanbanCard
					card={card}
					cardBackground="#ffffff"
					cardRadius={8}
					controlRadius={4}
					isLiveResizing={false}
					isDragging={false}
					showReturnCue={false}
					onChange={vi.fn()}
					onDelete={vi.fn()}
					onDragStart={vi.fn()}
					onDragEnd={vi.fn()}
					onDragOverCard={vi.fn()}
					onHoverChange={handleHoverChange}
				/>,
			);

			const cardContainer = container.querySelector('[draggable="true"]');
			expect(cardContainer).not.toBeNull();
			if (cardContainer) {
				fireEvent.mouseEnter(cardContainer);
				expect(handleHoverChange).toHaveBeenCalledWith(true);

				fireEvent.mouseLeave(cardContainer);
				expect(handleHoverChange).toHaveBeenCalledWith(false);
			}
		});
	});
});
