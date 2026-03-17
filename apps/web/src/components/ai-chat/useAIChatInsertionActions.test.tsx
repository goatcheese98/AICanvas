import { fetchAssistantArtifactAsset } from '@/lib/api';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantInsertionState } from './ai-chat-types';

vi.mock('@/lib/api', () => ({
	fetchAssistantArtifactAsset: vi.fn(async () => ({
		blob: {
			type: 'image/png',
			arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
			text: async () => '<svg viewBox="0 0 10 10"></svg>',
		} as unknown as Blob,
		mimeType: 'image/png',
	})),
	getRequiredAuthHeaders: vi.fn(async () => ({
		Authorization: 'Bearer test-token',
	})),
}));

vi.mock('@/lib/assistant/svg-to-excalidraw', () => ({
	compileSvgToExcalidraw: vi.fn(() => ({
		width: 240,
		height: 180,
		elements: [
			{
				id: 'vector-1',
				type: 'line',
				x: 0,
				y: 0,
				width: 120,
				height: 100,
				angle: 0,
				groupIds: ['vector-group'],
				customData: { type: 'ai-generated-vector-elements' },
			},
			{
				id: 'vector-2',
				type: 'line',
				x: 120,
				y: 40,
				width: 80,
				height: 80,
				angle: 0,
				groupIds: ['vector-group'],
				customData: { type: 'ai-generated-vector-elements' },
			},
		],
	})),
}));

vi.mock('@/lib/assistant/raster-to-svg', () => ({
	vectorizeRasterBlobToSvg: vi.fn(async () => '<svg viewBox="0 0 10 10"></svg>'),
}));

vi.mock('@/lib/assistant/sketch-vectorizer', () => ({
	vectorizeRasterBlobToSketchElements: vi.fn(async () => ({
		width: 260,
		height: 190,
		elements: [
			{
				id: 'layer-1',
				type: 'line',
				x: 0,
				y: 0,
				width: 140,
				height: 110,
				angle: 0,
				groupIds: ['layered-vector-group'],
				customData: { type: 'ai-generated-vector-elements', renderer: 'layered-sketch-vectorizer' },
			},
			{
				id: 'layer-2',
				type: 'line',
				x: 120,
				y: 30,
				width: 90,
				height: 90,
				angle: 0,
				groupIds: ['layered-vector-group'],
				customData: { type: 'ai-generated-vector-elements', renderer: 'layered-sketch-vectorizer' },
			},
		],
		metadata: {
			sourceWidth: 1024,
			sourceHeight: 1024,
			workingWidth: 640,
			workingHeight: 640,
			numColorsRequested: 12,
			numColorsUsed: 10,
			backgroundLabel: 0,
			morphologyKernelSize: 4,
			epsilon: 1.4,
			minArea: 18,
			componentsFound: 6,
			componentsFiltered: 1,
			elementsCreated: 5,
			elementsEmitted: 2,
			outlineComponentsFound: 3,
			outlineElementsCreated: 2,
			processingMs: 42,
		},
		logs: ['ok'],
	})),
}));

vi.mock('@excalidraw/excalidraw', async (importOriginal) => {
	const original = await importOriginal<typeof import('@excalidraw/excalidraw')>();
	return {
		...original,
		convertToExcalidrawElements: vi.fn(() => [
			{
				id: 'inserted-markdown',
				type: 'rectangle',
				x: 300,
				y: 200,
				width: 400,
				height: 450,
				angle: 0,
			},
		]),
	};
});

import { useAIChatInsertionActions } from './useAIChatInsertionActions';

describe('useAIChatInsertionActions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('inserts markdown artifacts onto the canvas and selects the inserted overlay', async () => {
		const updateScene = vi.fn();
		const setActiveTool = vi.fn();
		const setElements = vi.fn();
		const setFiles = vi.fn();
		const setChatError = vi.fn();
		const getSceneElements = vi.fn(() => []);
		const artifact: AssistantArtifact = {
			type: 'markdown',
			content: '# Insert me',
		};

		const { result } = renderHook(() => {
			const [assistantInsertionStates, setAssistantInsertionStates] = useState<
				Record<string, AssistantInsertionState>
			>({});
			return useAIChatInsertionActions({
				getToken: vi.fn(async () => 'token'),
				excalidrawApi: {
					getSceneElements,
					getAppState: () => ({
						scrollX: 0,
						scrollY: 0,
						width: 1280,
						height: 720,
						zoom: { value: 1 },
					}),
					getFiles: () => ({}),
					setActiveTool,
					updateScene,
				} as never,
				elements: [],
				selectedElementIds: {},
				setElements,
				setFiles,
				setChatError,
				assistantInsertionStates,
				setAssistantInsertionStates,
			});
		});

		await act(async () => {
			const insertionState = await result.current.insertArtifactOnCanvas(artifact);
			expect(insertionState).toMatchObject({
				status: 'inserted',
				insertedElementIds: ['inserted-markdown'],
			});
		});

		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({
					id: 'inserted-markdown',
				}),
			],
			appState: {
				croppingElementId: null,
				isCropping: false,
				selectedElementIds: {
					'inserted-markdown': true,
				},
			},
		});
		expect(setActiveTool).toHaveBeenCalledWith({
			type: 'selection',
			locked: false,
		});
		expect(setChatError).not.toHaveBeenCalled();
	});

	it('removes previously inserted artifacts from the scene and file map', () => {
		const updateScene = vi.fn();
		const setActiveTool = vi.fn();
		const setElements = vi.fn();
		const setFiles = vi.fn();
		const getSceneElements = vi.fn(() => [
			{ id: 'keep-1', type: 'rectangle' },
			{ id: 'inserted-markdown', type: 'rectangle' },
		]);
		const getFiles = vi.fn(() => ({
			fileA: { id: 'fileA', mimeType: 'image/png' },
			fileB: { id: 'fileB', mimeType: 'image/jpeg' },
		}));

		const { result } = renderHook(() => {
			const [assistantInsertionStates, setAssistantInsertionStates] = useState<
				Record<string, AssistantInsertionState>
			>({
				'artifact-1': {
					status: 'inserted',
					insertedElementIds: ['inserted-markdown'],
					insertedFileIds: ['fileB'],
				},
			});
			return {
				assistantInsertionStates,
				...useAIChatInsertionActions({
					getToken: vi.fn(async () => 'token'),
					excalidrawApi: {
						getSceneElements,
						getAppState: () => ({}),
						getFiles,
						setActiveTool,
						updateScene,
					} as never,
					elements: [],
					selectedElementIds: {},
					setElements,
					setFiles,
					setChatError: vi.fn(),
					assistantInsertionStates,
					setAssistantInsertionStates,
				}),
			};
		});

		act(() => {
			result.current.removeInsertedArtifact('artifact-1');
		});

		expect(updateScene).toHaveBeenCalledWith({
			elements: [{ id: 'keep-1', type: 'rectangle' }],
			appState: {
				croppingElementId: null,
				isCropping: false,
				selectedElementIds: {},
			},
		});
		expect(setActiveTool).toHaveBeenCalledWith({
			type: 'selection',
			locked: false,
		});
		expect(setFiles).toHaveBeenCalledWith({
			fileA: { id: 'fileA', mimeType: 'image/png' },
		});
		expect(result.current.assistantInsertionStates['artifact-1']).toMatchObject({
			status: 'removed',
		});
	});

	it('inserts stored image artifacts onto the canvas as image files', async () => {
		const updateScene = vi.fn();
		const addFiles = vi.fn();
		const setActiveTool = vi.fn();
		const setElements = vi.fn();
		const setFiles = vi.fn();
		const setChatError = vi.fn();
		const getSceneElements = vi.fn(() => []);
		const getFiles = vi.fn(() => ({}));
		const artifact: AssistantArtifact = {
			type: 'image',
			content: JSON.stringify({
				kind: 'stored_asset',
				r2Key: 'assistant-assets/run-1/image.png',
				mimeType: 'image/png',
				provider: 'cloudflare',
				model: '@cf/black-forest-labs/flux-2-klein-4b',
				artifactId: 'artifact-1',
				runId: 'run-1',
			}),
		};

		const { result } = renderHook(() => {
			const [assistantInsertionStates, setAssistantInsertionStates] = useState<
				Record<string, AssistantInsertionState>
			>({});
			return useAIChatInsertionActions({
				getToken: vi.fn(async () => 'token'),
				excalidrawApi: {
					addFiles,
					getSceneElements,
					getAppState: () => ({
						scrollX: 0,
						scrollY: 0,
						width: 1280,
						height: 720,
						zoom: { value: 1 },
					}),
					getFiles,
					setActiveTool,
					updateScene,
				} as never,
				elements: [],
				selectedElementIds: {},
				setElements,
				setFiles,
				setChatError,
				assistantInsertionStates,
				setAssistantInsertionStates,
			});
		});

		await act(async () => {
			const insertionState = await result.current.insertArtifactOnCanvas(artifact);
			expect(insertionState?.status).toBe('inserted');
			expect(insertionState?.insertedFileIds).toHaveLength(1);
		});

		expect(addFiles).toHaveBeenCalledOnce();
		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({
					type: 'image',
					fileId: expect.any(String),
				}),
			],
			appState: {
				croppingElementId: null,
				isCropping: false,
				selectedElementIds: expect.objectContaining({}),
			},
		});
		expect(setActiveTool).toHaveBeenCalledWith({
			type: 'selection',
			locked: false,
		});
		const storedFiles = setFiles.mock.calls[0]?.[0] as Record<string, { mimeType: string }>;
		expect(Object.values(storedFiles)).toEqual(
			expect.arrayContaining([expect.objectContaining({ mimeType: 'image/png' })]),
		);
		expect(setChatError).not.toHaveBeenCalled();
	});

	it('inserts vector svg artifacts as native Excalidraw elements', async () => {
		vi.mocked(fetchAssistantArtifactAsset).mockResolvedValueOnce({
			blob: {
				type: 'image/svg+xml',
				arrayBuffer: async () => new TextEncoder().encode('<svg></svg>').buffer,
				text: async () => '<svg viewBox="0 0 10 10"></svg>',
			} as unknown as Blob,
			mimeType: 'image/svg+xml',
		});
		const updateScene = vi.fn();
		const addFiles = vi.fn();
		const setActiveTool = vi.fn();
		const setElements = vi.fn();
		const setFiles = vi.fn();
		const setChatError = vi.fn();
		const getSceneElements = vi.fn(() => []);
		const getFiles = vi.fn(() => ({}));
		const artifact: AssistantArtifact = {
			type: 'image-vector',
			content: JSON.stringify({
				kind: 'stored_asset',
				r2Key: 'assistant-assets/run-1/vector.svg',
				mimeType: 'image/svg+xml',
				provider: 'http-tool',
				tool: 'vectorize_asset',
				artifactId: 'artifact-vec-1',
				runId: 'run-1',
			}),
		};

		const { result } = renderHook(() => {
			const [assistantInsertionStates, setAssistantInsertionStates] = useState<
				Record<string, AssistantInsertionState>
			>({});
			return useAIChatInsertionActions({
				getToken: vi.fn(async () => 'token'),
				excalidrawApi: {
					addFiles,
					getSceneElements,
					getAppState: () => ({
						scrollX: 0,
						scrollY: 0,
						width: 1280,
						height: 720,
						zoom: { value: 1 },
					}),
					getFiles,
					setActiveTool,
					updateScene,
				} as never,
				elements: [],
				selectedElementIds: {},
				setElements,
				setFiles,
				setChatError,
				assistantInsertionStates,
				setAssistantInsertionStates,
			});
		});

		await act(async () => {
			const insertionState = await result.current.insertArtifactOnCanvas(artifact);
			expect(insertionState).toMatchObject({
				status: 'inserted',
				insertedElementIds: ['vector-1', 'vector-2'],
			});
		});

		expect(addFiles).not.toHaveBeenCalled();
		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({ id: 'vector-1', type: 'line' }),
				expect.objectContaining({ id: 'vector-2', type: 'line' }),
			],
			appState: {
				croppingElementId: null,
				isCropping: false,
				selectedElementIds: {
					'vector-1': true,
					'vector-2': true,
				},
			},
		});
		expect(setFiles).not.toHaveBeenCalled();
		expect(setChatError).not.toHaveBeenCalled();
	});

	it('vectorizes raster sketch assets into native Excalidraw elements', async () => {
		const updateScene = vi.fn();
		const addFiles = vi.fn();
		const setActiveTool = vi.fn();
		const setElements = vi.fn();
		const setFiles = vi.fn();
		const setChatError = vi.fn();
		const getSceneElements = vi.fn(() => []);
		const getFiles = vi.fn(() => ({}));
		const artifact: AssistantArtifact = {
			type: 'image',
			content: JSON.stringify({
				kind: 'stored_asset',
				r2Key: 'assistant-assets/run-1/sketch.png',
				mimeType: 'image/png',
				provider: 'cloudflare',
				model: '@cf/black-forest-labs/flux-2-klein-4b',
				artifactId: 'artifact-sketch-1',
				runId: 'run-1',
			}),
		};

		const { result } = renderHook(() => {
			const [assistantInsertionStates, setAssistantInsertionStates] = useState<
				Record<string, AssistantInsertionState>
			>({});
			return useAIChatInsertionActions({
				getToken: vi.fn(async () => 'token'),
				excalidrawApi: {
					addFiles,
					getSceneElements,
					getAppState: () => ({
						scrollX: 0,
						scrollY: 0,
						width: 1280,
						height: 720,
						zoom: { value: 1 },
					}),
					getFiles,
					setActiveTool,
					updateScene,
				} as never,
				elements: [],
				selectedElementIds: {},
				setElements,
				setFiles,
				setChatError,
				assistantInsertionStates,
				setAssistantInsertionStates,
			});
		});

		await act(async () => {
			const insertionState = await result.current.vectorizeRasterAssetOnCanvas(artifact);
			expect(insertionState).toMatchObject({
				status: 'inserted',
				insertedElementIds: ['layer-1', 'layer-2'],
			});
		});

		expect(addFiles).not.toHaveBeenCalled();
		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({ id: 'layer-1', type: 'line' }),
				expect.objectContaining({ id: 'layer-2', type: 'line' }),
			],
			appState: {
				croppingElementId: null,
				isCropping: false,
				selectedElementIds: {
					'layer-1': true,
					'layer-2': true,
				},
			},
		});
		expect(setFiles).not.toHaveBeenCalled();
		expect(setChatError).not.toHaveBeenCalled();
	});

	it('prefers layered native vector insertion for svg vector artifacts when a source raster is available', async () => {
		vi.mocked(fetchAssistantArtifactAsset)
			.mockResolvedValueOnce({
				blob: {
					type: 'image/svg+xml',
					arrayBuffer: async () => new TextEncoder().encode('<svg></svg>').buffer,
					text: async () => '<svg viewBox="0 0 10 10"></svg>',
				} as unknown as Blob,
				mimeType: 'image/svg+xml',
			})
			.mockResolvedValueOnce({
				blob: {
					type: 'image/png',
					arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
					text: async () => 'png',
				} as unknown as Blob,
				mimeType: 'image/png',
			});
		const updateScene = vi.fn();
		const addFiles = vi.fn();
		const setActiveTool = vi.fn();
		const setElements = vi.fn();
		const setFiles = vi.fn();
		const setChatError = vi.fn();
		const getSceneElements = vi.fn(() => []);
		const getFiles = vi.fn(() => ({}));
		const artifact: AssistantArtifact = {
			type: 'image-vector',
			content: JSON.stringify({
				kind: 'stored_asset',
				r2Key: 'assistant-assets/run-1/vector.svg',
				mimeType: 'image/svg+xml',
				provider: 'http-tool',
				tool: 'vectorize_asset',
				artifactId: 'artifact-vec-2',
				runId: 'run-1',
				sourceArtifactId: 'artifact-source-raster',
			}),
		};

		const { result } = renderHook(() => {
			const [assistantInsertionStates, setAssistantInsertionStates] = useState<
				Record<string, AssistantInsertionState>
			>({});
			return useAIChatInsertionActions({
				getToken: vi.fn(async () => 'token'),
				excalidrawApi: {
					addFiles,
					getSceneElements,
					getAppState: () => ({
						scrollX: 0,
						scrollY: 0,
						width: 1280,
						height: 720,
						zoom: { value: 1 },
					}),
					getFiles,
					setActiveTool,
					updateScene,
				} as never,
				elements: [],
				selectedElementIds: {},
				setElements,
				setFiles,
				setChatError,
				assistantInsertionStates,
				setAssistantInsertionStates,
			});
		});

		await act(async () => {
			const insertionState = await result.current.insertArtifactOnCanvas(artifact);
			expect(insertionState).toMatchObject({
				status: 'inserted',
				insertedElementIds: ['layer-1', 'layer-2'],
			});
		});

		expect(addFiles).not.toHaveBeenCalled();
		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({ id: 'layer-1', type: 'line' }),
				expect.objectContaining({ id: 'layer-2', type: 'line' }),
			],
			appState: {
				croppingElementId: null,
				isCropping: false,
				selectedElementIds: {
					'layer-1': true,
					'layer-2': true,
				},
			},
		});
		expect(setFiles).not.toHaveBeenCalled();
		expect(setChatError).not.toHaveBeenCalled();
	});
});
