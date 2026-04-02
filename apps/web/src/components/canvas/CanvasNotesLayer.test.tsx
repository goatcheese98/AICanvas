import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasNotesLayer } from './CanvasNotesLayer';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => navigateMock,
}));

describe('CanvasNotesLayer', () => {
	beforeEach(() => {
		navigateMock.mockClear();
		useAppStore.setState({
			elements: [],
			appState: {
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 as never },
				selectedElementIds: {},
			},
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('recomputes overlay positioning when the same element object is mutated in place during drag', () => {
		const overlayElement = {
			id: 'overlay-1',
			type: 'rectangle',
			x: 100,
			y: 120,
			width: 400,
			height: 300,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'markdown',
				content: 'Hello',
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [overlayElement],
			appState: {
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 as never },
				selectedElementIds: { 'overlay-1': true },
			},
		});

		const { container, rerender } = render(<CanvasNotesLayer canvasId="canvas-1" />);
		const initialContainer = container.querySelector(
			'[style*="left: 100px;"][style*="top: 120px;"]',
		);

		expect(initialContainer).toBeTruthy();

		(overlayElement as { x: number }).x = 340;
		(overlayElement as { y: number }).y = 260;
		useAppStore.setState({
			elements: [overlayElement],
		});

		rerender(<CanvasNotesLayer canvasId="canvas-1" />);

		const movedContainer = container.querySelector('[style*="left: 340px;"][style*="top: 260px;"]');
		expect(movedContainer).toBeTruthy();
	});

	it('keeps the overlay locked to the canvas element across zoom and scroll changes', () => {
		const overlayElement = {
			id: 'overlay-zoom-lock',
			type: 'rectangle',
			x: 200,
			y: 160,
			width: 400,
			height: 300,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'markdown',
				content: 'Zoom me',
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [overlayElement],
			appState: {
				scrollX: 20,
				scrollY: -10,
				zoom: { value: 1 as never },
				selectedElementIds: { 'overlay-zoom-lock': true },
			},
		});

		const { container, rerender } = render(<CanvasNotesLayer canvasId="canvas-1" />);
		const initialContainer = container.querySelector(
			'[style*="left: 220px;"][style*="top: 150px;"]',
		);

		expect(initialContainer).toBeTruthy();

		useAppStore.setState({
			elements: [overlayElement],
			appState: {
				scrollX: -30,
				scrollY: 15,
				zoom: { value: 1.5 as never },
				selectedElementIds: { 'overlay-zoom-lock': true },
			},
		});

		rerender(<CanvasNotesLayer canvasId="canvas-1" />);

		const movedContainer = container.querySelector(
			'[style*="left: 355px;"][style*="top: 337.5px;"][style*="transform: scale(1.5) rotate(0rad);"]',
		);
		expect(movedContainer).toBeTruthy();
	});

	it('does not capture pointer events for an unselected kanban board preview', () => {
		const boardElement = {
			id: 'board-preview',
			type: 'rectangle',
			x: 80,
			y: 100,
			width: 360,
			height: 240,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'kanban',
				title: 'Preview Board',
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [boardElement],
			appState: {
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 as never },
				selectedElementIds: {},
			},
		});

		const { container } = render(<CanvasNotesLayer canvasId="canvas-1" />);
		const boardOverlay = container.querySelector(
			'[data-overlay-id="board-preview"]',
		) as HTMLElement;

		expect(boardOverlay).toBeTruthy();
		expect(boardOverlay.style.pointerEvents).toBe('none');
	});

	it('keeps selected documents in preview mode on canvas', () => {
		const documentElement = {
			id: 'document-preview',
			type: 'rectangle',
			x: 120,
			y: 160,
			width: 420,
			height: 280,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'newlex',
				title: 'Preview Document',
				lexicalState: JSON.stringify({
					root: {
						children: [
							{
								type: 'paragraph',
								version: 1,
								children: [{ text: 'Document preview content.' }],
							},
						],
						type: 'root',
						version: 1,
					},
				}),
				comments: [],
				commentsPanelOpen: false,
				version: 1,
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [documentElement],
			appState: {
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 as never },
				selectedElementIds: { 'document-preview': true },
			},
		});

		render(<CanvasNotesLayer canvasId="canvas-1" />);

		expect(screen.getAllByText('Rich text')[0]).toBeTruthy();
		expect(screen.getAllByText('Document preview content.')[0]).toBeTruthy();
	});

	it('navigates to the focused document route when a selected document card is double-clicked', () => {
		const documentElement = {
			id: 'document-open',
			type: 'rectangle',
			x: 120,
			y: 160,
			width: 420,
			height: 280,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'newlex',
				title: 'Open Document',
				lexicalState: '{"root":{"children":[],"type":"root","version":1}}',
				comments: [],
				commentsPanelOpen: false,
				version: 1,
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [documentElement],
			appState: {
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 as never },
				selectedElementIds: { 'document-open': true },
			},
		});

		const { container } = render(<CanvasNotesLayer canvasId="canvas-1" />);
		const documentOverlay = container.querySelector(
			'[data-overlay-id="document-open"]',
		) as HTMLElement;

		fireEvent.doubleClick(documentOverlay);

		expect(navigateMock).toHaveBeenCalledWith({
			to: '/canvas/$id/document/$documentId',
			params: { id: 'canvas-1', documentId: 'document-open' },
		});
	});

	it('navigates to the focused document route from the explicit open action', () => {
		const documentElement = {
			id: 'document-open-button',
			type: 'rectangle',
			x: 120,
			y: 160,
			width: 420,
			height: 280,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'newlex',
				title: 'Open Document',
				lexicalState: '{"root":{"children":[],"type":"root","version":1}}',
				comments: [],
				commentsPanelOpen: false,
				version: 1,
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [documentElement],
			appState: {
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 as never },
				selectedElementIds: { 'document-open-button': true },
			},
		});

		render(<CanvasNotesLayer canvasId="canvas-1" />);

		fireEvent.click(screen.getByRole('button', { name: 'Open Document' }));

		expect(navigateMock).toHaveBeenCalledWith({
			to: '/canvas/$id/document/$documentId',
			params: { id: 'canvas-1', documentId: 'document-open-button' },
		});
	});
});
