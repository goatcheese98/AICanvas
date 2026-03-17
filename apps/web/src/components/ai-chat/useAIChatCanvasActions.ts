import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback, useState } from 'react';
import type {
	AssistantInsertionState,
	AssistantPatchApplyState,
	MarkdownPatchReviewState,
} from './ai-chat-types';
import { useAIChatInsertionActions } from './useAIChatInsertionActions';
import { useAIChatPatchActions } from './useAIChatPatchActions';

export function useAIChatCanvasActions({
	getToken,
	excalidrawApi,
	elements,
	selectedElementIds,
	setElements,
	setFiles,
	setChatError,
}: {
	getToken: () => Promise<string | null>;
	excalidrawApi: ExcalidrawImperativeAPI | null;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setFiles: (files: BinaryFiles) => void;
	setChatError: (error: string | null) => void;
}) {
	const [assistantPatchStates, setAssistantPatchStates] = useState<
		Record<string, AssistantPatchApplyState>
	>({});
	const [assistantInsertionStates, setAssistantInsertionStates] = useState<
		Record<string, AssistantInsertionState>
	>({});
	const [markdownPatchReviewStates, setMarkdownPatchReviewStates] = useState<
		Record<string, MarkdownPatchReviewState>
	>({});

	const updateMarkdownPatchAcceptedHunks = useCallback(
		(artifactKey: string, acceptedHunkIds: string[]) => {
			setMarkdownPatchReviewStates((current) => ({
				...current,
				[artifactKey]: {
					acceptedHunkIds: [...acceptedHunkIds],
				},
			}));
		},
		[],
	);

	const patchActions = useAIChatPatchActions({
		excalidrawApi,
		setElements,
		setChatError,
		assistantPatchStates,
		setAssistantPatchStates,
	});

	const insertionActions = useAIChatInsertionActions({
		getToken,
		excalidrawApi,
		elements,
		selectedElementIds,
		setElements,
		setFiles,
		setChatError,
		assistantInsertionStates,
		setAssistantInsertionStates,
	});

	return {
		assistantPatchStates,
		setAssistantPatchStates,
		assistantInsertionStates,
		setAssistantInsertionStates,
		markdownPatchReviewStates,
		setMarkdownPatchReviewStates,
		updateMarkdownPatchAcceptedHunks,
		...patchActions,
		...insertionActions,
	};
}
