import { buildPersistedCanvasData } from '@/components/canvas/canvas-persistence-utils';
import {
	createOverlayElementDraft,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import {
	syncAppStoreSnapshot,
	updateSceneAndSyncAppStore,
} from '@/components/canvas/excalidraw-store-sync';
import { api, getRequiredAuthHeaders, toApiUrl } from '@/lib/api';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQueryClient } from '@tanstack/react-query';
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

interface CanvasQueryData {
	canvas?: {
		id?: string;
		title?: unknown;
		version?: unknown;
	};
	data?: {
		elements?: readonly ExcalidrawElement[];
		appState?: Record<string, unknown>;
		files?: Record<string, unknown> | null;
	};
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
	const queryClient = useQueryClient();
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const appState = useAppStore((s) => s.appState);
	const files = useAppStore((s) => s.files);

	const getCachedCanvasQueryData = useCallback(
		() => queryClient.getQueryData(['canvas', canvasId]) as CanvasQueryData | undefined,
		[canvasId, queryClient],
	);

	const getCachedCanvasVersion = useCallback(() => {
		const version = getCachedCanvasQueryData()?.canvas?.version;
		return typeof version === 'number' && version > 0 ? version : null;
	}, [getCachedCanvasQueryData]);

	const syncCanvasQueryCache = useCallback(
		(
			nextElements: readonly ExcalidrawElement[],
			nextAppState: Record<string, unknown>,
			nextFiles: Record<string, unknown> | null,
			nextVersion: number | null,
		) => {
			queryClient.setQueryData(['canvas', canvasId], (current) => {
				const cached = (current ?? {}) as CanvasQueryData;
				return {
					...cached,
					canvas: {
						...(cached.canvas ?? {}),
						version:
							nextVersion ??
							(typeof cached.canvas?.version === 'number' ? cached.canvas.version : 1),
					},
					data: {
						...(cached.data ?? {}),
						elements: nextElements,
						appState: nextAppState,
						files: nextFiles,
					},
				};
			});
		},
		[canvasId, queryClient],
	);

	const persistCanvasElements = useCallback(
		async (
			nextElements: readonly ExcalidrawElement[],
			nextAppState: Record<string, unknown>,
			nextFiles: Record<string, unknown> | null,
		) => {
			const expectedVersion = getCachedCanvasVersion();
			syncCanvasQueryCache(nextElements, nextAppState, nextFiles, expectedVersion);

			if (expectedVersion === null) {
				return;
			}

			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas[':id'].$put(
				{
					param: { id: canvasId },
					json: {
						...buildPersistedCanvasData(nextElements as never[], nextAppState, nextFiles),
						expectedVersion,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const result = (await response.json()) as { version: number };
			syncCanvasQueryCache(nextElements, nextAppState, nextFiles, result.version);
		},
		[canvasId, getCachedCanvasVersion, getToken, syncCanvasQueryCache],
	);

	const createResource = useCallback(
		async (options: CreateResourceOptions): Promise<CreateResourceResult> => {
			const { type } = options;

			if (type === 'canvas') {
				setIsCreating(true);

				try {
					const cachedCanvases = queryClient.getQueryData(['canvases']) as
						| { items?: Array<{ title?: string }> }
						| undefined;
					const existingTitles = new Set(
						(cachedCanvases?.items ?? [])
							.map((canvas) => (typeof canvas.title === 'string' ? canvas.title.trim() : ''))
							.filter(Boolean),
					);
					const baseTitle = 'Untitled Canvas';
					let title = baseTitle;
					let suffix = 2;
					while (existingTitles.has(title)) {
						title = `${baseTitle} ${suffix}`;
						suffix += 1;
					}

					const headers = await getRequiredAuthHeaders(getToken);
					const response = await api.api.canvas.create.$post(
						{
							json: {
								title,
								description: '',
								isPublic: false,
							},
						},
						{ headers },
					);

					if (!response.ok) {
						throw new Error(await response.text());
					}

					const canvas = (await response.json()) as { id: string };
					void queryClient.invalidateQueries({ queryKey: ['canvases'] });
					onSuccess?.({ id: canvas.id, type }, type);
					return { success: true, elementId: canvas.id };
				} catch (error) {
					const err = error instanceof Error ? error : new Error('Failed to create resource');
					onError?.(err);
					return { success: false, error: err };
				} finally {
					setIsCreating(false);
				}
			}

			setIsCreating(true);

			try {
				const cachedCanvasQueryData = getCachedCanvasQueryData();
				const fallbackElements =
					(cachedCanvasQueryData?.data?.elements as readonly ExcalidrawElement[] | undefined) ?? [];
				const fallbackAppState = (cachedCanvasQueryData?.data?.appState ?? {}) as Partial<
					typeof appState
				>;
				const currentElements = excalidrawApi?.getSceneElements() ?? fallbackElements;
				const insertionAppState = excalidrawApi ? appState : fallbackAppState;

				if (!excalidrawApi && !cachedCanvasQueryData) {
					throw new Error('Canvas is not ready');
				}

				// Get viewport center for element placement
				const sceneCenter = getViewportSceneCenter(insertionAppState);

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
				const resourceCustomData = resourceSnapshot
					? ({
							...draft.customData,
							resourceSnapshot,
						} as typeof draft.customData)
					: draft.customData;
				const draftWithSnapshot = resourceSnapshot
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
				const nextAppState = {
					...insertionAppState,
					selectedElementIds: { [draft.id]: true },
				} as Record<string, unknown>;
				const nextFiles = Object.keys(files).length > 0 ? { ...files } : null;
				const nextStoreFiles = nextFiles ?? {};

				if (excalidrawApi) {
					updateSceneAndSyncAppStore(
						excalidrawApi,
						{
							elements: nextElements,
							appState: {
								selectedElementIds: { [draft.id]: true },
							},
						},
						{
							elements: nextElements,
							appState: nextAppState,
							files: nextStoreFiles,
						},
					);
				} else {
					syncAppStoreSnapshot({
						elements: nextElements,
						appState: nextAppState,
						files: nextStoreFiles,
					});
				}

				await persistCanvasElements(nextElements, nextAppState, nextFiles);

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
		[
			appState,
			canvasId,
			excalidrawApi,
			files,
			getCachedCanvasQueryData,
			getToken,
			onError,
			onSuccess,
			persistCanvasElements,
			queryClient,
		],
	);

	return { createResource, isCreating };
}
