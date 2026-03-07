import { describe, expect, it } from 'vitest';
import {
	applyOverlayUpdateByType,
	collectOverlayElements,
	getOverlayZIndex,
} from './overlay-registry';

describe('overlay-registry', () => {
	it('collects only overlay elements', () => {
		const elements = [
			{
				id: 'md-1',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 300,
				height: 200,
				angle: 0,
				customData: {
					type: 'markdown',
					content: 'hello',
				},
			},
			{
				id: 'shape-1',
				type: 'rectangle',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				angle: 0,
			},
		] as any;

		const overlays = collectOverlayElements(elements);

		expect(overlays).toHaveLength(1);
		expect(overlays[0]?.id).toBe('md-1');
	});

	it('applies markdown updates and bumps element version', () => {
		const element = {
			id: 'md-1',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			angle: 0,
			version: 2,
			versionNonce: 7,
			customData: {
				type: 'markdown',
				content: 'old',
				images: { a: 'b' },
			},
		} as any;

		const updated = applyOverlayUpdateByType('markdown', element, {
			content: 'new',
			images: { c: 'd' },
		});

		expect(updated.version).toBe(3);
		expect(updated.customData).toMatchObject({
			type: 'markdown',
			content: 'new',
			images: { c: 'd' },
		});
	});

	it('applies kanban updates by replacing custom data payload', () => {
		const element = {
			id: 'kanban-1',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			angle: 0,
			version: 1,
			versionNonce: 5,
			customData: {
				type: 'kanban',
				title: 'Old',
				columns: [],
			},
		} as any;

		const updated = applyOverlayUpdateByType('kanban', element, {
			type: 'kanban',
			title: 'New',
			columns: [{ id: 'todo', title: 'Todo', cards: [] }],
			bgTheme: 'parchment',
			fontId: 'outfit',
			fontSize: 13,
		});

		expect(updated.version).toBe(2);
		expect(updated.customData.title).toBe('New');
		expect(updated.customData.columns).toHaveLength(1);
	});

	it('calculates z-index with selection and editing promotion', () => {
		expect(getOverlayZIndex(false, false, 2)).toBe(20);
		expect(getOverlayZIndex(true, false, 2)).toBe(22);
		expect(getOverlayZIndex(true, true, 2)).toBe(25);
	});
});
