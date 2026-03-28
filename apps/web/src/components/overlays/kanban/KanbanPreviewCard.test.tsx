import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { KanbanPreviewCard } from './KanbanPreviewCard';

// Clean up after each test to avoid duplicate element issues
afterEach(() => {
	cleanup();
});

function createElement(customData?: Partial<KanbanOverlayCustomData>) {
	return {
		id: 'kanban-element',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 500,
		height: 400,
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
			title: 'Test Board',
			columns: [
				{
					id: 'col-1',
					title: 'To Do',
					cards: [
						{ id: 'card-1', title: 'Task 1', priority: 'high' },
						{ id: 'card-2', title: 'Task 2', priority: 'medium' },
					],
				},
				{
					id: 'col-2',
					title: 'Done',
					cards: [{ id: 'card-3', title: 'Task 3', priority: 'low' }],
				},
			],
			...customData,
		},
	} as Parameters<typeof KanbanPreviewCard>[0]['element'];
}

describe('KanbanPreviewCard', () => {
	it('renders the board title when provided', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		expect(screen.getByText('Test Board')).not.toBeNull();
	});

	it('shows "Untitled board" when title is not provided', () => {
		render(<KanbanPreviewCard element={createElement({ title: '' })} isSelected={false} />);

		expect(screen.getByText('Untitled board')).not.toBeNull();
	});

	it('displays the total card count', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		// Use getAllByText and check first occurrence since there might be multiple
		const cardCountElements = screen.getAllByText('3 cards');
		expect(cardCountElements.length).toBeGreaterThan(0);
	});

	it('displays singular "card" when there is one card', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [{ id: 'col-1', title: 'To Do', cards: [{ id: 'card-1', title: 'Task 1' }] }],
				})}
				isSelected={false}
			/>,
		);

		const cardCountElements = screen.getAllByText('1 card');
		expect(cardCountElements.length).toBeGreaterThan(0);
	});

	it('renders column titles', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		// Use getAllByText since column titles may appear in multiple places
		const toDoElements = screen.getAllByText('To Do');
		const doneElements = screen.getAllByText('Done');
		expect(toDoElements.length).toBeGreaterThan(0);
		expect(doneElements.length).toBeGreaterThan(0);
	});

	it('displays column card counts', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		// Use getAllByText since numbers may appear in multiple contexts
		const count2Elements = screen.getAllByText('2');
		const count1Elements = screen.getAllByText('1');
		expect(count2Elements.length).toBeGreaterThan(0); // To Do count
		expect(count1Elements.length).toBeGreaterThan(0); // Done count
	});

	it('renders card titles', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		// Use getAllByText since card titles may appear in multiple places
		expect(screen.getAllByText('Task 1').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Task 2').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Task 3').length).toBeGreaterThan(0);
	});

	it('shows "No cards" when a column has no cards', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [{ id: 'col-1', title: 'Empty', cards: [] }],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getByText('No cards')).not.toBeNull();
	});

	it('shows "No columns" when board has no columns', () => {
		render(<KanbanPreviewCard element={createElement({ columns: [] })} isSelected={false} />);

		expect(screen.getByText('No columns')).not.toBeNull();
	});

	it('displays column count in footer', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		const columnCountElements = screen.getAllByText('2 columns');
		expect(columnCountElements.length).toBeGreaterThan(0);
	});

	it('displays singular "column" when there is one column', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [{ id: 'col-1', title: 'To Do', cards: [] }],
				})}
				isSelected={false}
			/>,
		);

		const columnCountElements = screen.getAllByText('1 column');
		expect(columnCountElements.length).toBeGreaterThan(0);
	});

	it('shows "Double-click to edit" hint', () => {
		render(<KanbanPreviewCard element={createElement()} isSelected={false} />);

		const hintElements = screen.getAllByText('Double-click to edit');
		expect(hintElements.length).toBeGreaterThan(0);
	});

	it('displays overdue count when there are overdue cards', () => {
		// Use a date far in the past to ensure it's overdue
		const pastDate = new Date('2020-01-01');
		const dueDate = pastDate.toISOString().split('T')[0];

		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [
						{
							id: 'col-1',
							title: 'To Do',
							cards: [{ id: 'card-1', title: 'Overdue Task', dueDate }],
						},
					],
				})}
				isSelected={false}
			/>,
		);

		// Use a more flexible text matcher since the text might be rendered with extra whitespace
		const overdueElements = screen.getAllByText((content) => content.includes('overdue'));
		expect(overdueElements.length).toBeGreaterThan(0);
	});

	it('shows checklist progress when cards have checklists', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [
						{
							id: 'col-1',
							title: 'To Do',
							cards: [
								{
									id: 'card-1',
									title: 'Task with checklist',
									checklist: [
										{ id: 'item-1', text: 'Item 1', done: true },
										{ id: 'item-2', text: 'Item 2', done: false },
										{ id: 'item-3', text: 'Item 3', done: false },
									],
								},
							],
						},
					],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getByText('1/3')).not.toBeNull();
	});

	it('limits displayed columns to 3', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [
						{ id: 'col-1', title: 'Column 1', cards: [] },
						{ id: 'col-2', title: 'Column 2', cards: [] },
						{ id: 'col-3', title: 'Column 3', cards: [] },
						{ id: 'col-4', title: 'Column 4', cards: [] },
					],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getByText('+1 more columns')).not.toBeNull();
	});

	it('limits displayed cards per column to 2', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [
						{
							id: 'col-1',
							title: 'Column 1',
							cards: [
								{ id: 'card-1', title: 'Task 1' },
								{ id: 'card-2', title: 'Task 2' },
								{ id: 'card-3', title: 'Task 3' },
							],
						},
					],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getByText('+1 more')).not.toBeNull();
	});

	it('handles long board titles gracefully', () => {
		const longTitle = 'A'.repeat(200);
		render(<KanbanPreviewCard element={createElement({ title: longTitle })} isSelected={false} />);

		// Should render without crashing and show the title
		expect(screen.getByText(longTitle)).not.toBeNull();
	});

	it('handles cards without priority', () => {
		render(
			<KanbanPreviewCard
				element={createElement({
					columns: [
						{
							id: 'col-1',
							title: 'To Do',
							cards: [{ id: 'card-1', title: 'Task without priority' }],
						},
					],
				})}
				isSelected={false}
			/>,
		);

		expect(screen.getByText('Task without priority')).not.toBeNull();
	});
});
