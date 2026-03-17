import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CanvasNotesLayer } from './CanvasNotesLayer';

describe('CanvasNotesLayer', () => {
	beforeEach(() => {
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

		const { container, rerender } = render(<CanvasNotesLayer />);
		const initialContainer = container.querySelector(
			'[style*="left: 100px;"][style*="top: 120px;"]',
		);

		expect(initialContainer).toBeTruthy();

		(overlayElement as { x: number }).x = 340;
		(overlayElement as { y: number }).y = 260;
		useAppStore.setState({
			elements: [overlayElement],
		});

		rerender(<CanvasNotesLayer />);

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

		const { container, rerender } = render(<CanvasNotesLayer />);
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

		rerender(<CanvasNotesLayer />);

		const movedContainer = container.querySelector(
			'[style*="left: 355px;"][style*="top: 337.5px;"][style*="transform: scale(1.5) rotate(0rad);"]',
		);
		expect(movedContainer).toBeTruthy();
	});
});
