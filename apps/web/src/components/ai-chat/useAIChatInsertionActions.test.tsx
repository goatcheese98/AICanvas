import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { AssistantInsertionState } from './ai-chat-types';

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
				selectedElementIds: {
					'inserted-markdown': true,
				},
			},
		});
		expect(setElements).toHaveBeenCalled();
		expect(setChatError).not.toHaveBeenCalled();
	});

	it('removes previously inserted artifacts from the scene and file map', () => {
		const updateScene = vi.fn();
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
					excalidrawApi: {
						getSceneElements,
						getAppState: () => ({}),
						getFiles,
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
				selectedElementIds: {},
			},
		});
		expect(setFiles).toHaveBeenCalledWith({
			fileA: { id: 'fileA', mimeType: 'image/png' },
		});
		expect(result.current.assistantInsertionStates['artifact-1']).toMatchObject({
			status: 'removed',
		});
	});
});
