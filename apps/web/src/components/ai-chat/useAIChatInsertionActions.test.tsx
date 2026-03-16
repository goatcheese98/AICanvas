import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { AssistantInsertionState } from './ai-chat-types';

vi.mock('@/lib/api', () => ({
	fetchAssistantArtifactAsset: vi.fn(async () => ({
		blob: {
			type: 'image/png',
			arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
		} as unknown as Blob,
		mimeType: 'image/png',
	})),
	getRequiredAuthHeaders: vi.fn(async () => ({
		Authorization: 'Bearer test-token',
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
});
