import { describe, expect, it } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
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
});
