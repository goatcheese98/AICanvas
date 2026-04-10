import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { normalizeSceneElement } from './scene-element-normalizer';

describe('scene-element-normalizer', () => {
	it('fills in excalidraw defaults required by scene rendering', () => {
		const normalized = normalizeSceneElement({
			id: 'overlay-1',
			type: 'rectangle',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			customData: { type: 'kanban', title: 'Board', columns: [] },
		} as unknown as ExcalidrawElement);

		expect(normalized.groupIds).toEqual([]);
		expect(normalized.boundElements).toBeNull();
		expect(normalized.frameId).toBeNull();
		expect(normalized.roundness).toBeNull();
		expect(normalized.index).toBe('a0');
		expect(normalized.version).toBe(1);
		expect(normalized.isDeleted).toBe(false);
		expect(typeof normalized.seed).toBe('number');
	});

	it('preserves a valid fractional index and rejects timestamp-like indices', () => {
		const valid = normalizeSceneElement({
			id: 'overlay-valid',
			type: 'rectangle',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			index: 'Zz',
		} as unknown as ExcalidrawElement);
		const invalid = normalizeSceneElement({
			id: 'overlay-invalid',
			type: 'rectangle',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			index: 'a1773614343380',
		} as unknown as ExcalidrawElement);

		expect(valid.index).toBe('Zz');
		expect(invalid.index).toBe('a0');
	});
});
