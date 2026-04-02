import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateSceneAndSyncAppStoreMock } = vi.hoisted(() => ({
	updateSceneAndSyncAppStoreMock: vi.fn(),
}));

vi.mock('./canvas-container-utils', () => ({
	toBinaryFileList: vi.fn((files) => files),
	toBinaryFiles: vi.fn((files) => files ?? {}),
	toSceneElements: vi.fn((elements) => elements ?? []),
	toSceneUpdateAppState: vi.fn((state) => state ?? {}),
}));

vi.mock('./excalidraw-store-sync', () => ({
	updateSceneAndSyncAppStore: updateSceneAndSyncAppStoreMock,
}));

vi.mock('./scene-element-normalizer', () => ({
	normalizeSceneElements: vi.fn((elements) => elements),
}));

import { useCanvasInitialization } from './useCanvasInitialization';

describe('useCanvasInitialization', () => {
	beforeEach(() => {
		updateSceneAndSyncAppStoreMock.mockReset();
		vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		}) as typeof requestAnimationFrame);
	});

	it('prefers remote canvas data over a newer local snapshot when remote data exists', async () => {
		const excalidrawApi = {
			updateScene: vi.fn(),
			addFiles: vi.fn(),
			refresh: vi.fn(),
			getAppState: vi.fn(() => ({
				selectedElementIds: {},
				scrollX: 0,
				scrollY: 0,
				zoom: { value: 1 },
			})),
			getFiles: vi.fn(() => ({})),
		} as const;
		const onInitialized = vi.fn();

		renderHook(() =>
			useCanvasInitialization({
				canvasId: 'canvas-1',
				excalidrawApi: excalidrawApi as never,
				status: 'success',
				fetchStatus: 'idle',
				canvasQueryData: {
					canvas: {
						updatedAt: '2026-03-22T00:00:00.000Z',
					},
					data: {
						elements: [{ id: 'remote' }],
						appState: { viewBackgroundColor: '#ffffff' },
						files: null,
					},
				},
				loadSnapshot: () => ({
					canvasId: 'canvas-1',
					savedAt: Date.now() + 60_000,
					canvasData: {
						elements: [{ id: 'local' }],
						appState: { viewBackgroundColor: '#000000' },
						files: null,
					},
				}),
				onInitialized,
			}),
		);

		await waitFor(() => {
			expect(updateSceneAndSyncAppStoreMock).toHaveBeenCalledWith(
				excalidrawApi,
				{
					elements: [{ id: 'remote' }],
					appState: { viewBackgroundColor: '#ffffff' },
				},
				{
					elements: [{ id: 'remote' }],
					appState: expect.objectContaining({ viewBackgroundColor: '#ffffff' }),
					files: {},
				},
			);
		});

		expect(onInitialized).toHaveBeenCalledWith({
			elements: [{ id: 'remote' }],
			appState: { viewBackgroundColor: '#ffffff' },
			files: null,
		});
		expect(updateSceneAndSyncAppStoreMock).toHaveBeenCalledTimes(1);
	});
});
