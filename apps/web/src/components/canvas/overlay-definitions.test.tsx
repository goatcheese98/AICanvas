import { describe, expect, it } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { normalizeOverlayElement, type TypedOverlayCanvasElement } from './overlay-definitions';

function createMarkdownOverlay(
	overrides?: Partial<TypedOverlayCanvasElement['customData']>,
): TypedOverlayCanvasElement {
	return {
		id: 'markdown-overlay',
		type: 'rectangle',
		x: 100,
		y: 120,
		width: 420,
		height: 300,
		angle: 0,
		strokeColor: '#111827',
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
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
			type: 'markdown',
			title: 'Note',
			content: 'Hello',
			...overrides,
		},
	} as ExcalidrawElement as TypedOverlayCanvasElement;
}

describe('normalizeOverlayElement', () => {
	it('returns the same normalized object for the same element instance', () => {
		const element = createMarkdownOverlay();

		const first = normalizeOverlayElement('markdown', element);
		const second = normalizeOverlayElement('markdown', element);

		expect(first).toBe(second);
	});

	it('returns a new normalized object for a new element instance', () => {
		const firstElement = createMarkdownOverlay();
		const secondElement = createMarkdownOverlay({
			content: 'Updated content',
		});

		const first = normalizeOverlayElement('markdown', firstElement);
		const second = normalizeOverlayElement('markdown', secondElement);

		expect(first).not.toBe(second);
		expect(second.customData.content).toBe('Updated content');
	});
});
