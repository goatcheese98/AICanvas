import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { rasterBlobToSvg } from '@/lib/assistant/raster-to-svg';
import { vectorizeSketch } from '@/lib/assistant/sketch-vectorizer';
import { compileSvgToExcalidraw } from '@/lib/assistant/svg-to-excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it, vi } from 'vitest';
import {
	compileRasterBlobToNativeVector,
	insertNativeVectorElementsOnCanvas,
} from './ai-chat-vector-insertion';

vi.mock('@/components/canvas/excalidraw-store-sync', () => ({
	syncAppStoreFromExcalidraw: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
	addObservabilityBreadcrumb: vi.fn(),
}));

vi.mock('@/lib/assistant/raster-to-svg', () => ({
	rasterBlobToSvg: vi.fn(async () => '<svg viewBox="0 0 10 10"></svg>'),
}));

vi.mock('@/lib/assistant/sketch-vectorizer', () => ({
	vectorizeSketch: vi.fn(),
}));

vi.mock('@/lib/assistant/svg-to-excalidraw', () => ({
	compileSvgToExcalidraw: vi.fn(() => ({
		width: 120,
		height: 90,
		elements: [
			{ id: 'fallback-1', type: 'line', x: 0, y: 0, width: 60, height: 40, angle: 0 },
		] as unknown as ExcalidrawElement[],
	})),
}));

vi.mock('./ai-chat-canvas-mutations', async (importOriginal) => {
	const original = await importOriginal<typeof import('./ai-chat-canvas-mutations')>();
	return {
		...original,
		resolveInsertionSceneCenter: vi.fn(() => ({ x: 200, y: 160 })),
		restoreCanvasSelectionState: vi.fn(),
	};
});

describe('ai chat vector insertion helpers', () => {
	it('falls back to SVG compilation when sketch vectorization fails', async () => {
		vi.mocked(vectorizeSketch).mockRejectedValueOnce(new Error('vectorizer failed'));

		const result = await compileRasterBlobToNativeVector(
			new Blob(['png-bytes'], { type: 'image/png' }),
			{
				source: 'artifact-raster',
				customData: { source: 'test-raster' },
			},
		);

		expect(rasterBlobToSvg).toHaveBeenCalledOnce();
		expect(compileSvgToExcalidraw).toHaveBeenCalledWith(
			'<svg viewBox="0 0 10 10"></svg>',
			expect.objectContaining({ customData: { source: 'test-raster' } }),
		);
		expect(result).toMatchObject({
			strategy: 'svg-trace',
			width: 120,
			height: 90,
			elements: [expect.objectContaining({ id: 'fallback-1' })],
		});
	});

	it('inserts compiled native vector elements and selects them', async () => {
		const updateScene = vi.fn();
		const getSceneElements = vi.fn(() => []);

		const result = await insertNativeVectorElementsOnCanvas({
			compiled: {
				strategy: 'svg-compile',
				width: 140,
				height: 110,
				elements: [
					{
						id: 'vec-1',
						type: 'line',
						x: 0,
						y: 0,
						width: 60,
						height: 50,
						angle: 0,
						backgroundColor: '#111111',
					} as unknown as ExcalidrawElement,
					{
						id: 'vec-2',
						type: 'line',
						x: 20,
						y: 20,
						width: 30,
						height: 20,
						angle: 0,
						backgroundColor: '#111111',
					} as unknown as ExcalidrawElement,
				],
			},
			excalidrawApi: {
				getSceneElements,
				getAppState: () => ({
					scrollX: 0,
					scrollY: 0,
					width: 1280,
					height: 720,
					zoom: { value: 1 },
				}),
				updateScene,
			} as never,
			elements: [],
			selectedElementIds: {},
		});

		expect(updateScene).toHaveBeenCalledWith({
			elements: expect.arrayContaining([
				expect.objectContaining({ id: 'vec-1' }),
				expect.objectContaining({ id: 'vec-2' }),
			]),
			appState: {
				isCropping: false,
				croppingElementId: null,
				selectedElementIds: {
					'vec-1': true,
					'vec-2': true,
				},
			},
		});
		expect(syncAppStoreFromExcalidraw).toHaveBeenCalled();
		expect(result).toEqual({
			status: 'inserted',
			insertedElementIds: ['vec-1', 'vec-2'],
			insertMode: 'native-vector',
			vectorStrategy: 'svg-compile',
		});
	});
});
