import {
	createOverlayElementDraft,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { getRequiredAuthHeaders, toApiUrl } from '@/lib/api';
import { useAppStore } from '@/stores/store';
import { useAuth } from '@clerk/clerk-react';
import type { OverlayType } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useState } from 'react';

export type ResourceCreationType =
	| 'canvas'
	| 'board'
	| 'document'
	| 'prototype'
	| 'quick-note'
	| 'web-embed';

interface CreateResourceOptions {
	type: ResourceCreationType;
}

interface CreateResourceResult {
	success: boolean;
	elementId?: string;
	error?: Error;
}

interface UseNewResourceCreationOptions {
	canvasId: string;
	onSuccess?: (resource: { id: string; type: ResourceCreationType }, type: string) => void;
	onError?: (error: Error) => void;
}

interface UseNewResourceCreationReturn {
	createResource: (options: CreateResourceOptions) => Promise<CreateResourceResult>;
	isCreating: boolean;
}

// Map resource types to overlay types
const RESOURCE_TO_OVERLAY_TYPE: Record<Exclude<ResourceCreationType, 'canvas'>, OverlayType> = {
	board: 'kanban',
	document: 'newlex',
	prototype: 'prototype',
	'quick-note': 'markdown',
	'web-embed': 'web-embed',
};

export function useNewResourceCreation({
	canvasId,
	onSuccess,
	onError,
}: UseNewResourceCreationOptions): UseNewResourceCreationReturn {
	const [isCreating, setIsCreating] = useState(false);
	const { getToken } = useAuth();
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const appState = useAppStore((s) => s.appState);
	const setElements = useAppStore((s) => s.setElements);

	const createResource = useCallback(
		async (options: CreateResourceOptions): Promise<CreateResourceResult> => {
			const { type } = options;

			// Canvas creation is handled separately (navigates to dashboard)
			if (type === 'canvas') {
				return { success: true };
			}

			if (!excalidrawApi) {
				const error = new Error('Canvas is not ready');
				onError?.(error);
				return { success: false, error };
			}

			setIsCreating(true);

			try {
				// Get current elements
				const currentElements = excalidrawApi.getSceneElements();

				// Get viewport center for element placement
				const sceneCenter = getViewportSceneCenter(appState);

				// Get overlay type
				const overlayType = RESOURCE_TO_OVERLAY_TYPE[type];

				// Prepare custom data based on resource type
				let customData: Record<string, unknown> | undefined;
				let resourceTitle: string | null = null;
				let resourceSubtitle: string | null = null;
				let resourceSummary: string | null = null;

				switch (type) {
					case 'board':
						resourceTitle = 'New Board';
						resourceSubtitle = 'Board';
						resourceSummary = '3 columns';
						// Reference-only: no columns payload, just snapshot metadata
						customData = {
							title: resourceTitle,
						};
						break;
					case 'document':
						resourceTitle = 'New Document';
						resourceSubtitle = 'Document';
						resourceSummary = 'Empty note';
						// Reference-only: no lexicalState/comments payload
						customData = {
							title: resourceTitle,
						};
						break;
					case 'prototype':
						resourceTitle = 'New Prototype';
						resourceSubtitle = 'Prototype';
						resourceSummary = '1 file';
						// Reference-only: no files/dependencies payload
						customData = {
							title: resourceTitle,
							template: 'react',
						};
						break;
					case 'quick-note':
						customData = {
							title: 'Quick Note',
							content: '# Quick Note\n\nDouble-click to edit this note.',
						};
						break;
					case 'web-embed':
						customData = {
							url: '',
						};
						break;
				}

				const draft = createOverlayElementDraft(overlayType, sceneCenter, customData);
				const resourceSnapshot =
					type === 'board' || type === 'document' || type === 'prototype'
						? {
								resourceType: type,
								resourceId: draft.id,
								title: resourceTitle ?? '',
								snapshotVersion: 1,
								display: {
									subtitle: resourceSubtitle ?? undefined,
									summary: resourceSummary ?? undefined,
									badge: 'New',
								},
							}
						: null;
				const resourceCustomData =
					resourceSnapshot
						? ({
								...draft.customData,
								resourceSnapshot,
							} as typeof draft.customData)
						: draft.customData;
				const draftWithSnapshot =
					resourceSnapshot
						? ({
								...draft,
								customData: resourceCustomData,
							} as typeof draft)
						: draft;
				if (type === 'board' || type === 'document' || type === 'prototype') {
					const headers = await getRequiredAuthHeaders(getToken);
					const response = await fetch(
						toApiUrl(`/api/canvas/${canvasId}/resources/${type}/${draft.id}`),
						{
							method: 'PUT',
							headers: {
								...headers,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								title: resourceTitle ?? '',
								data: draftWithSnapshot.customData,
							}),
						},
					);

					if (!response.ok) {
						throw new Error(await response.text());
					}
				}

				const newElement = draftWithSnapshot as unknown as ExcalidrawElement;
				const nextElements = [...currentElements, newElement];

				excalidrawApi.updateScene({
					elements: nextElements,
					appState: {
						selectedElementIds: { [draft.id]: true },
					},
				});

				setElements(nextElements);

				onSuccess?.({ id: draft.id, type }, type);

				return { success: true, elementId: draft.id };
			} catch (error) {
				const err = error instanceof Error ? error : new Error('Failed to create resource');
				onError?.(err);
				return { success: false, error: err };
			} finally {
				setIsCreating(false);
			}
		},
		[canvasId, excalidrawApi, appState, getToken, setElements, onSuccess, onError],
	);

	return { createResource, isCreating };
}
