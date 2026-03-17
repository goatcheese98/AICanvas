import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { describe, expect, it, vi } from 'vitest';
import {
	resolveInsertionSceneCenter,
	restoreCanvasSelectionState,
} from './ai-chat-canvas-mutations';

vi.mock('@/lib/api', () => ({
	fetchAssistantArtifactAsset: vi.fn(),
	getRequiredAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
}));

vi.mock('@/components/canvas/excalidraw-store-sync', () => ({
	syncAppStoreFromExcalidraw: vi.fn(),
}));

vi.mock('./ai-chat-canvas-mutations', async (importOriginal) => {
	const original = await importOriginal<typeof import('./ai-chat-canvas-mutations')>();
	return {
		...original,
		resolveInsertionSceneCenter: vi.fn(() => ({ x: 240, y: 180 })),
		restoreCanvasSelectionState: vi.fn(),
	};
});

import { insertStoredAssetOnCanvas, vectorizeRasterAssetOnCanvas } from './ai-chat-stored-asset-insertion';

describe('ai chat stored asset insertion helpers', () => {
	it('rejects stored assets without a downloadable reference', async () => {
		const setChatError = vi.fn();

		const result = await insertStoredAssetOnCanvas({
			artifact: {
				type: 'image',
				content: JSON.stringify({
					kind: 'stored_asset',
					r2Key: 'assistant-assets/run-1/image.png',
					mimeType: 'image/png',
					provider: 'cloudflare',
				}),
			},
			getToken: vi.fn(async () => 'token'),
			excalidrawApi: {} as never,
			elements: [],
			selectedElementIds: {},
			setFiles: vi.fn(),
			setChatError,
		});

		expect(result).toBeNull();
		expect(setChatError).toHaveBeenCalledWith(
			'This generated asset is missing a downloadable reference.',
		);
	});

	it('inserts raster stored assets as canvas image files', async () => {
		vi.mocked(fetchAssistantArtifactAsset).mockResolvedValueOnce({
			blob: {
				type: 'image/png',
				arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
			} as unknown as Blob,
			mimeType: 'image/png',
		});

		const addFiles = vi.fn();
		const updateScene = vi.fn();
		const getSceneElements = vi.fn(() => []);
		const getFiles = vi.fn(() => ({}));
		const setFiles = vi.fn();
		const setChatError = vi.fn();

		const result = await insertStoredAssetOnCanvas({
			artifact: {
				type: 'image',
				content: JSON.stringify({
					kind: 'stored_asset',
					r2Key: 'assistant-assets/run-1/image.png',
					mimeType: 'image/png',
					provider: 'cloudflare',
					artifactId: 'artifact-1',
					runId: 'run-1',
				}),
			},
			getToken: vi.fn(async () => 'token'),
			excalidrawApi: {
				addFiles,
				getSceneElements,
				getFiles,
				getAppState: () => ({ scrollX: 0, scrollY: 0, width: 1280, height: 720, zoom: { value: 1 } }),
				updateScene,
			} as never,
			elements: [],
			selectedElementIds: {},
			setFiles,
			setChatError,
		});

		expect(getRequiredAuthHeaders).toHaveBeenCalled();
		expect(fetchAssistantArtifactAsset).toHaveBeenCalledWith(
			'run-1',
			'artifact-1',
			expect.objectContaining({ Authorization: 'Bearer test-token' }),
		);
		expect(resolveInsertionSceneCenter).toHaveBeenCalled();
		expect(addFiles).toHaveBeenCalledOnce();
		expect(updateScene).toHaveBeenCalledWith({
			elements: [expect.objectContaining({ type: 'image', fileId: expect.any(String) })],
			appState: {
				isCropping: false,
				croppingElementId: null,
				selectedElementIds: expect.objectContaining({}),
			},
		});
		expect(restoreCanvasSelectionState).toHaveBeenCalled();
		expect(syncAppStoreFromExcalidraw).toHaveBeenCalled();
		expect(result).toMatchObject({
			status: 'inserted',
			insertedElementIds: [expect.any(String)],
			insertedFileIds: [expect.any(String)],
		});
		expect(setFiles).toHaveBeenCalledWith(expect.any(Object));
		expect(setChatError).not.toHaveBeenCalled();
	});

	it('rejects vectorization requests for non-raster assets', async () => {
		vi.mocked(fetchAssistantArtifactAsset).mockResolvedValueOnce({
			blob: {
				type: 'image/svg+xml',
				arrayBuffer: async () => new TextEncoder().encode('<svg></svg>').buffer,
			} as unknown as Blob,
			mimeType: 'image/svg+xml',
		});

		const setChatError = vi.fn();

		const result = await vectorizeRasterAssetOnCanvas({
			artifact: {
				type: 'image',
				content: JSON.stringify({
					kind: 'stored_asset',
					r2Key: 'assistant-assets/run-1/image.svg',
					mimeType: 'image/svg+xml',
					provider: 'cloudflare',
					artifactId: 'artifact-2',
					runId: 'run-1',
				}),
			},
			getToken: vi.fn(async () => 'token'),
			excalidrawApi: {} as never,
			elements: [],
			selectedElementIds: {},
			setChatError,
		});

		expect(result).toBeNull();
		expect(setChatError).toHaveBeenCalledWith(
			'Only raster image assets can be vectorized from this card.',
		);
	});
});
