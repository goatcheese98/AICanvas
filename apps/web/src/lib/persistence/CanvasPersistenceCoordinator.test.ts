import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type CanvasData, CanvasPersistenceCoordinator } from './CanvasPersistenceCoordinator';

const sampleData: CanvasData = {
	elements: [{ id: 'a' }],
	appState: { scrollX: 1 },
	files: null,
};

function createStorageMock() {
	const store = new Map<string, string>();

	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
	};
}

describe('CanvasPersistenceCoordinator', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createStorageMock());
		localStorage.clear();
		vi.useRealTimers();
	});

	it('loads only data for the matching canvas id', () => {
		const coordinator = new CanvasPersistenceCoordinator();

		coordinator.forceSave(sampleData, 'canvas-a');
		coordinator.forceSave(
			{
				elements: [{ id: 'b' }],
				appState: { scrollX: 2 },
				files: null,
			},
			'canvas-b',
		);

		expect(coordinator.loadFromStorage('canvas-a')).toEqual(sampleData);
		expect(coordinator.loadFromStorage('canvas-b')?.elements).toEqual([{ id: 'b' }]);
		expect(coordinator.loadFromStorage('canvas-c')).toBeNull();
		expect(coordinator.loadSnapshotFromStorage('canvas-a')?.canvasData).toEqual(sampleData);
	});

	it('accepts legacy storage only when the canvas id matches', () => {
		localStorage.setItem(
			'excalidraw-canvas-data',
			JSON.stringify({
				version: 2,
				canvasData: sampleData,
				savedAt: Date.now(),
				canvasId: 'legacy-canvas',
			}),
		);

		const coordinator = new CanvasPersistenceCoordinator();

		expect(coordinator.loadFromStorage('legacy-canvas')).toEqual(sampleData);
		expect(coordinator.loadFromStorage('other-canvas')).toBeNull();
	});
});
