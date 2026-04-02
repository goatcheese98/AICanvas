import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExpandedOverlayLayer } from './ExpandedOverlayLayer';

describe('ExpandedOverlayLayer', () => {
	beforeEach(() => {
		useAppStore.setState({
			elements: [],
			expandedOverlayId: null,
		});
	});

	it('closes unsupported heavy resource overlays instead of opening them in the shell', async () => {
		const boardElement = {
			id: 'board-shell',
			type: 'rectangle',
			x: 40,
			y: 60,
			width: 520,
			height: 320,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'kanban',
				title: 'Migration Board',
				columns: [],
				bgTheme: 'parchment',
				fontId: 'excalifont',
				fontSize: 13,
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [boardElement],
			expandedOverlayId: 'board-shell',
		});

		render(<ExpandedOverlayLayer />);

		await waitFor(() => {
			expect(useAppStore.getState().expandedOverlayId).toBeNull();
		});
	});

	it('keeps markdown overlays expandable', () => {
		const markdownElement = {
			id: 'markdown-shell',
			type: 'rectangle',
			x: 40,
			y: 60,
			width: 420,
			height: 320,
			angle: 0,
			isDeleted: false,
			customData: {
				type: 'markdown',
				title: 'Note',
				content: 'Expandable note body',
				images: {},
			},
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [markdownElement],
			expandedOverlayId: 'markdown-shell',
		});

		render(<ExpandedOverlayLayer />);

		expect(useAppStore.getState().expandedOverlayId).toBe('markdown-shell');
	});
});
