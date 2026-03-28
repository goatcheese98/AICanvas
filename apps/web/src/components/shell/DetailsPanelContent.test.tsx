import type { TypedOverlayCanvasElement } from '@/components/canvas/overlay-definition-types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailsPanelContent } from './DetailsPanelContent';

describe('DetailsPanelContent', () => {
	const onOpenFocusedView = vi.fn();
	const onDeleteElement = vi.fn();

	beforeEach(() => {
		cleanup();
		onOpenFocusedView.mockClear();
		onDeleteElement.mockClear();
	});

	const createMockElement = (
		type: string,
		customData: Record<string, unknown>,
	): TypedOverlayCanvasElement =>
		({
			id: 'test-id',
			type: 'rectangle',
			x: 100,
			y: 200,
			width: 400,
			height: 300,
			customData: { type, ...customData },
		}) as unknown as TypedOverlayCanvasElement;

	it('shows placeholder when no element is selected', () => {
		const { container } = render(
			<DetailsPanelContent
				element={null}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('Select an item to view details');
	});

	it('renders kanban board details', () => {
		const element = createMockElement('kanban', {
			title: 'My Kanban Board',
			columns: [
				{ id: 'col1', title: 'To Do', cards: [{ id: 'card1', title: 'Task 1' }] },
				{ id: 'col2', title: 'Done', cards: [] },
			],
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('My Kanban Board');
		expect(container.textContent).toContain('Kanban Board');
		expect(container.textContent).toContain('Columns');
		expect(container.textContent).toContain('2'); // Column count
		expect(container.textContent).toContain('Cards');
		expect(container.textContent).toContain('1'); // Card count
	});

	it('renders snapshot metadata for kanban resources', () => {
		const element = createMockElement('kanban', {
			title: 'My Kanban Board',
			columns: [],
			resourceSnapshot: {
				resourceType: 'board',
				resourceId: 'board-1',
				title: 'My Kanban Board',
				snapshotVersion: 1,
				display: {
					badge: 'New',
				},
			},
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('Snapshot');
		expect(container.textContent).toContain('New');
	});

	it('renders newlex document details', () => {
		const element = createMockElement('newlex', {
			title: 'My Document',
			comments: [
				{
					id: 'c1',
					author: 'user',
					comment: 'test',
					anchorText: '',
					createdAt: 123,
					resolved: false,
					collapsed: false,
					replies: [],
				},
			],
			version: 3,
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('My Document');
		expect(container.textContent).toContain('Document');
		expect(container.textContent).toContain('Comments');
		expect(container.textContent).toContain('1'); // Comment count
		expect(container.textContent).toContain('Version');
		expect(container.textContent).toContain('3'); // Version
	});

	it('renders markdown note details', () => {
		const element = createMockElement('markdown', {
			title: 'My Note',
			content: 'This is a test note with some words',
			editorMode: 'hybrid',
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('My Note');
		expect(container.textContent).toContain('Note');
		expect(container.textContent).toContain('Mode');
		expect(container.textContent).toContain('Hybrid');
		expect(container.textContent).toContain('Words');
		expect(container.textContent).toContain('8'); // Word count ("This is a test note with some words" = 8 words)
	});

	it('renders web embed details', () => {
		const element = createMockElement('web-embed', {
			url: 'https://example.com/page',
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('Web Embed');
		expect(container.textContent).toContain('Domain');
		expect(container.textContent).toContain('example.com');
	});

	it('shows default title when no title is provided', () => {
		const element = createMockElement('kanban', {
			columns: [],
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('Untitled Board');
	});

	it('displays element properties', () => {
		const element = createMockElement('markdown', {
			content: 'Test',
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('Properties');
		expect(container.textContent).toContain('Size');
		expect(container.textContent).toContain('400');
		expect(container.textContent).toContain('300');
		expect(container.textContent).toContain('Position');
		expect(container.textContent).toContain('100');
		expect(container.textContent).toContain('200');
	});

	it('calls onOpenFocusedView when Open button is clicked', () => {
		const element = createMockElement('kanban', {
			title: 'Test Board',
			columns: [],
		});

		render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		// Find the Open button by looking for the button with "Open" text in its subtree
		const buttons = screen.getAllByRole('button');
		const openButton = buttons.find((btn) => btn.textContent?.includes('Open'));
		expect(openButton).toBeDefined();

		if (openButton) {
			fireEvent.click(openButton);
			expect(onOpenFocusedView).toHaveBeenCalledWith('test-id');
		}
	});

	it('calls onDeleteElement when Delete button is clicked', () => {
		const element = createMockElement('kanban', {
			title: 'Test Board',
			columns: [],
		});

		render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		// Find the Delete button by looking for the button with "Delete" text
		const buttons = screen.getAllByRole('button');
		const deleteButton = buttons.find((btn) => btn.textContent?.includes('Delete'));
		expect(deleteButton).toBeDefined();

		if (deleteButton) {
			fireEvent.click(deleteButton);
			expect(onDeleteElement).toHaveBeenCalledWith('test-id');
		}
	});

	it('renders Ask AI button', () => {
		const element = createMockElement('kanban', {
			title: 'Test Board',
			columns: [],
		});

		render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		const buttons = screen.getAllByRole('button');
		const askAiButton = buttons.find((btn) => btn.textContent?.includes('Ask AI'));
		expect(askAiButton).toBeDefined();
	});

	it('formats kanban lastUpdated date', () => {
		const now = Date.now();
		const element = createMockElement('kanban', {
			title: 'Test Board',
			columns: [],
			lastUpdated: now - 1000 * 60 * 5, // 5 minutes ago
		});

		const { container } = render(
			<DetailsPanelContent
				element={element}
				onOpenFocusedView={onOpenFocusedView}
				onDeleteElement={onDeleteElement}
			/>,
		);

		expect(container.textContent).toContain('Updated');
		expect(container.textContent).toContain('5m ago');
	});
});
