import { svgToDataUrl } from '@/lib/assistant/diagram-renderer';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { type Dispatch, type SetStateAction, useCallback } from 'react';
import { removeInsertedArtifactFromScene } from './ai-chat-canvas-mutations';
import {
	insertKanbanArtifactOnCanvas,
	insertMarkdownOnCanvas as insertMarkdownOnCanvasInternal,
	insertRenderedDiagramOnCanvas as insertRenderedDiagramOnCanvasInternal,
} from './ai-chat-overlay-insertion';
import {
	insertStoredAssetOnCanvas as insertStoredAssetOnCanvasInternal,
	vectorizeRasterAssetOnCanvas as vectorizeRasterAssetOnCanvasInternal,
} from './ai-chat-stored-asset-insertion';
import type { AssistantInsertionState } from './ai-chat-types';
import {
	compileSvgMarkupToNativeVector,
	describeNativeVectorPipelineError,
	insertNativeVectorElementsOnCanvas,
} from './ai-chat-vector-insertion';
import { buildMarkdownArtifactContent } from './assistant-artifacts';

export function useAIChatInsertionActions({
	getToken,
	excalidrawApi,
	elements,
	selectedElementIds,
	setElements,
	setFiles,
	setChatError,
	assistantInsertionStates,
	setAssistantInsertionStates,
}: {
	getToken: () => Promise<string | null>;
	excalidrawApi: ExcalidrawImperativeAPI | null;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setFiles: (files: BinaryFiles) => void;
	setChatError: (error: string | null) => void;
	assistantInsertionStates: Record<string, AssistantInsertionState>;
	setAssistantInsertionStates: Dispatch<SetStateAction<Record<string, AssistantInsertionState>>>;
}) {
	const removeInsertedArtifact = useCallback(
		(artifactKey: string) => {
			const insertionState = assistantInsertionStates[artifactKey];
			if (!insertionState || !excalidrawApi) {
				return;
			}

			removeInsertedArtifactFromScene({
				excalidrawApi,
				setElements,
				insertionState,
			});
			setAssistantInsertionStates((current) => ({
				...current,
				[artifactKey]: {
					...insertionState,
					status: 'removed',
				},
			}));
		},
		[assistantInsertionStates, excalidrawApi, setAssistantInsertionStates, setElements],
	);

	const insertMarkdownOnCanvas = useCallback(
		async (content: string): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			return insertMarkdownOnCanvasInternal({
				content,
				excalidrawApi,
				elements,
				selectedElementIds,
				setElements,
			});
		},
		[elements, excalidrawApi, selectedElementIds, setChatError, setElements],
	);

	const insertRenderedDiagramOnCanvas = useCallback(
		async (input: {
			title: string;
			svgMarkup: string;
			width: number;
			height: number;
			diagram: {
				language: 'mermaid' | 'd2';
				code: string;
			};
		}): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			return insertRenderedDiagramOnCanvasInternal({
				input: {
					...input,
					svgMarkup: svgToDataUrl(input.svgMarkup),
				},
				excalidrawApi,
				elements,
				selectedElementIds,
				setFiles,
			});
		},
		[elements, excalidrawApi, selectedElementIds, setChatError, setFiles],
	);

	const insertSvgMarkupOnCanvas = useCallback(
		async (svgMarkup: string): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			try {
				const compiled = compileSvgMarkupToNativeVector(svgMarkup, {
					source: 'stored-svg',
					customData: {
						source: 'assistant-svg-message',
					},
				});
				return insertNativeVectorElementsOnCanvas({
					compiled,
					excalidrawApi,
					elements,
					selectedElementIds,
				});
			} catch (error) {
				setChatError(
					describeNativeVectorPipelineError(
						error,
						'This SVG could not be converted into native canvas elements.',
					),
				);
				return null;
			}
		},
		[elements, excalidrawApi, selectedElementIds, setChatError],
	);

	const vectorizeRasterAssetOnCanvas = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			return vectorizeRasterAssetOnCanvasInternal({
				artifact,
				getToken,
				excalidrawApi,
				elements,
				selectedElementIds,
				setChatError,
			});
		},
		[elements, excalidrawApi, getToken, selectedElementIds, setChatError],
	);

	const insertStoredAssetOnCanvas = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			return insertStoredAssetOnCanvasInternal({
				artifact,
				getToken,
				excalidrawApi,
				elements,
				selectedElementIds,
				setFiles,
				setChatError,
			});
		},
		[elements, excalidrawApi, getToken, selectedElementIds, setChatError, setFiles],
	);

	const rememberInsertionState = useCallback(
		(artifactKey: string, insertionState: AssistantInsertionState) => {
			setAssistantInsertionStates((current) => ({
				...current,
				[artifactKey]: insertionState,
			}));
		},
		[setAssistantInsertionStates],
	);

	const insertArtifactOnCanvas = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			switch (artifact.type) {
				case 'kanban-ops':
					return await insertKanbanArtifactOnCanvas({
						artifact,
						excalidrawApi,
						elements,
						selectedElementIds,
						setElements,
					});
				case 'mermaid':
				case 'd2':
				case 'markdown':
					return await insertMarkdownOnCanvas(buildMarkdownArtifactContent(artifact));
				case 'image':
				case 'image-vector':
					return await insertStoredAssetOnCanvas(artifact);
				default:
					setChatError('This artifact type is not insertable yet.');
					return null;
			}
		},
		[
			elements,
			excalidrawApi,
			insertMarkdownOnCanvas,
			insertStoredAssetOnCanvas,
			selectedElementIds,
			setChatError,
			setElements,
		],
	);

	return {
		removeInsertedArtifact,
		insertMarkdownOnCanvas,
		insertRenderedDiagramOnCanvas,
		insertSvgMarkupOnCanvas,
		vectorizeRasterAssetOnCanvas,
		insertStoredAssetOnCanvas,
		rememberInsertionState,
		insertArtifactOnCanvas,
	};
}
