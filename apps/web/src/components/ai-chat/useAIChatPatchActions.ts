import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { type Dispatch, type SetStateAction, useCallback } from 'react';
import { updateOverlayElementById } from './ai-chat-canvas-mutations';
import { clonePatchCustomData } from './ai-chat-helpers';
import type { AssistantPatchApplyOptions, AssistantPatchApplyState } from './ai-chat-types';
import {
	parseKanbanPatchArtifact,
	parseMarkdownPatchArtifact,
} from './assistant-artifacts';

export function useAIChatPatchActions({
	excalidrawApi,
	setElements,
	setChatError,
	assistantPatchStates,
	setAssistantPatchStates,
}: {
	excalidrawApi: ExcalidrawImperativeAPI | null;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setChatError: (error: string | null) => void;
	assistantPatchStates: Record<string, AssistantPatchApplyState>;
	setAssistantPatchStates: Dispatch<SetStateAction<Record<string, AssistantPatchApplyState>>>;
}) {
	const applyAssistantPatch = useCallback(
		(
			artifactKey: string,
			artifact: AssistantArtifact,
			mode: 'apply' | 'reapply' = 'apply',
			options?: AssistantPatchApplyOptions,
		) => {
			try {
				const markdownPatch = parseMarkdownPatchArtifact(artifact);
				if (markdownPatch) {
					const nextMarkdownContent =
						options?.markdownContentOverride ?? markdownPatch.next.content;
					const previousCustomData =
						mode === 'reapply'
							? assistantPatchStates[artifactKey]?.previousCustomData
							: updateOverlayElementById({
									excalidrawApi,
									setElements,
									targetId: markdownPatch.targetId,
									targetType: 'markdown',
									payload: {
										type: 'markdown',
										title: markdownPatch.next.title,
										content: nextMarkdownContent,
										images: markdownPatch.next.images,
										settings: markdownPatch.next.settings,
										editorMode: markdownPatch.next.editorMode,
									},
								});

					if (mode === 'reapply') {
						updateOverlayElementById({
							excalidrawApi,
							setElements,
							targetId: markdownPatch.targetId,
							targetType: 'markdown',
							payload: {
								type: 'markdown',
								title: markdownPatch.next.title,
								content: nextMarkdownContent,
								images: markdownPatch.next.images,
								settings: markdownPatch.next.settings,
								editorMode: markdownPatch.next.editorMode,
							},
						});
					}

					setAssistantPatchStates((current) => ({
						...current,
						[artifactKey]: {
							status: 'applied',
							targetId: markdownPatch.targetId,
							targetType: 'markdown',
							previousCustomData: clonePatchCustomData(previousCustomData),
						},
					}));
					return true;
				}

				const kanbanPatch = parseKanbanPatchArtifact(artifact);
				if (kanbanPatch) {
					const previousCustomData =
						mode === 'reapply'
							? assistantPatchStates[artifactKey]?.previousCustomData
							: updateOverlayElementById({
									excalidrawApi,
									setElements,
									targetId: kanbanPatch.targetId,
									targetType: 'kanban',
									payload: kanbanPatch.next as unknown as Record<string, unknown>,
								});

					if (mode === 'reapply') {
						updateOverlayElementById({
							excalidrawApi,
							setElements,
							targetId: kanbanPatch.targetId,
							targetType: 'kanban',
							payload: kanbanPatch.next as unknown as Record<string, unknown>,
						});
					}

					setAssistantPatchStates((current) => ({
						...current,
						[artifactKey]: {
							status: 'applied',
							targetId: kanbanPatch.targetId,
							targetType: 'kanban',
							previousCustomData: clonePatchCustomData(previousCustomData),
						},
					}));
					return true;
				}

				throw new Error('Patch artifact is invalid.');
			} catch (error) {
				setChatError(error instanceof Error ? error.message : 'Failed to apply patch');
				return false;
			}
		},
		[assistantPatchStates, excalidrawApi, setAssistantPatchStates, setChatError, setElements],
	);

	const undoAssistantPatch = useCallback(
		(artifactKey: string) => {
			const patchState = assistantPatchStates[artifactKey];
			if (!patchState) {
				setChatError('Patch history is unavailable.');
				return;
			}

			try {
				updateOverlayElementById({
					excalidrawApi,
					setElements,
					targetId: patchState.targetId,
					targetType: patchState.targetType,
					payload: patchState.previousCustomData,
				});
				setAssistantPatchStates((current) => ({
					...current,
					[artifactKey]: {
						...patchState,
						status: 'undone',
					},
				}));
			} catch (error) {
				setChatError(error instanceof Error ? error.message : 'Failed to undo patch');
			}
		},
		[assistantPatchStates, excalidrawApi, setAssistantPatchStates, setChatError, setElements],
	);

	return {
		applyAssistantPatch,
		undoAssistantPatch,
	};
}
