import { useCollaboration } from '@/hooks/useCollaboration';
import { useMountEffect } from '@/hooks/useMountEffect';
import {
	api,
	createObservedResponseError,
	getRequiredAuthHeaders,
	observedFetch,
	toApiUrl,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import {
	type CanvasData,
	CanvasPersistenceCoordinator,
} from '@/lib/persistence/CanvasPersistenceCoordinator';
import { type AppStore, useAppStore } from '@/stores/store';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { normalizeAiVectorGroupResize } from './ai-vector-resize-normalizer';
import {
	getExportToBlob,
	getThumbnailSignature,
	toBinaryFileList,
	toBinaryFiles,
	toSceneElements,
	toSceneUpdateAppState,
} from './canvas-container-utils';
import { buildPersistedCanvasData, shouldWaitForCanvasHydration } from './canvas-persistence-utils';
import { syncAppStoreFromExcalidraw } from './excalidraw-store-sync';
import { normalizeSceneElements } from './scene-element-normalizer';

const SERVER_SAVE_THROTTLE_MS = 5000;
const THUMBNAIL_MIME_TYPE = 'image/png';

type HydratedCanvasScene = {
	elements?: readonly Record<string, unknown>[] | null;
	appState?: Record<string, unknown> | null;
	files?: BinaryFiles | null;
};

interface UseCanvasContainerStateProps {
	canvasId: string;
}

interface UseCanvasContainerStateReturn {
	// Store state
	excalidrawApi: AppStore['excalidrawApi'];
	elements: readonly ExcalidrawElement[];
	appState: Partial<AppState>;
	files: BinaryFiles;

	// Collaboration
	collaboration: ReturnType<typeof useCollaboration>;

	// Event handlers
	handleSaveNeeded: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => void;
	normalizeSceneChange: (
		nextElements: readonly ExcalidrawElement[],
		nextAppState: AppState,
		_nextFiles: BinaryFiles,
		previousElements: readonly ExcalidrawElement[],
	) => readonly ExcalidrawElement[] | null;

	// Query state for initialization check
	isInitialized: boolean;
	canvasQueryData: ReturnType<typeof useQuery>['data'];
	status: ReturnType<typeof useQuery>['status'];
}

export function useCanvasContainerState({
	canvasId,
}: UseCanvasContainerStateProps): UseCanvasContainerStateReturn {
	const { getToken } = useAuth();
	const queryClient = useQueryClient();
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const elements = useAppStore((s) => s.elements);
	const appState = useAppStore((s) => s.appState);
	const files = useAppStore((s) => s.files);
	const setPersistenceState = useAppStore((s) => s.setPersistenceState);
	const addToast = useAppStore((s) => s.addToast);

	const collaboration = useCollaboration({
		onError: (message: string) => addToast({ message, type: 'error' }),
	});

	// Coordinator is stable for the lifetime of this component
	const coordinatorRef = useRef<CanvasPersistenceCoordinator | null>(null);
	if (!coordinatorRef.current) {
		coordinatorRef.current = new CanvasPersistenceCoordinator({
			onStateChange: setPersistenceState,
		});
	}

	// Throttled server save — only fires after 5s of inactivity
	const serverSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestSceneRef = useRef<CanvasData | null>(null);
	const latestThumbnailSignatureRef = useRef<string | null>(null);
	const inFlightThumbnailSignatureRef = useRef<string | null>(null);

	const persistThumbnail = useCallback(
		async (data: CanvasData) => {
			const signature = getThumbnailSignature(data);
			if (
				signature === latestThumbnailSignatureRef.current ||
				signature === inFlightThumbnailSignatureRef.current
			) {
				return;
			}

			const nonDeletedElements = data.elements.filter(
				(element) => (element as Record<string, unknown>).isDeleted !== true,
			);
			if (nonDeletedElements.length === 0) return;

			inFlightThumbnailSignatureRef.current = signature;

			try {
				const exportToBlob = await getExportToBlob();
				const blob = await exportToBlob({
					elements: nonDeletedElements as never,
					appState: {
						...(data.appState ?? {}),
						exportBackground: true,
						viewBackgroundColor:
							typeof data.appState?.viewBackgroundColor === 'string'
								? data.appState.viewBackgroundColor
								: '#ffffff',
					},
					files: (data.files ?? {}) as Record<string, unknown> as never,
					mimeType: THUMBNAIL_MIME_TYPE,
					exportPadding: 16,
				});

				const headers = await getRequiredAuthHeaders(getToken);
				const response = await observedFetch(toApiUrl(`/api/canvas/${canvasId}/thumbnail`), {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': THUMBNAIL_MIME_TYPE,
					},
					body: blob,
				});

				if (!response.ok) {
					throw await createObservedResponseError(
						response,
						`Thumbnail upload failed with status ${response.status}`,
					);
				}

				latestThumbnailSignatureRef.current = signature;
				void queryClient.invalidateQueries({ queryKey: ['canvases'] });
			} catch (err) {
				console.error('Thumbnail upload failed:', err);
				captureBrowserException(err, {
					tags: {
						area: 'canvas.thumbnail',
						action: 'upload',
					},
					extra: {
						canvasId,
						signature,
					},
				});
			} finally {
				if (inFlightThumbnailSignatureRef.current === signature) {
					inFlightThumbnailSignatureRef.current = null;
				}
			}
		},
		[canvasId, getToken, queryClient],
	);

	const persistServerSave = useCallback(
		async (data: CanvasData) => {
			try {
				const headers = await getRequiredAuthHeaders(getToken);
				const response = await api.api.canvas[':id'].$put(
					{
						param: { id: canvasId },
						json: {
							elements: data.elements as Record<string, unknown>[],
							appState: data.appState,
							files: data.files as Record<string, unknown> | null,
						},
					},
					{ headers },
				);

				if (!response.ok) {
					throw new Error(await response.text());
				}

				await Promise.all([
					queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] }),
					queryClient.invalidateQueries({ queryKey: ['canvases'] }),
				]);
				void persistThumbnail(data);
			} catch (err) {
				console.error('Server auto-save failed:', err);
				captureBrowserException(err, {
					tags: {
						area: 'canvas.save',
						action: 'server_autosave',
					},
					extra: {
						canvasId,
						elementCount: data.elements.length,
					},
				});
			}
		},
		[canvasId, getToken, persistThumbnail, queryClient],
	);

	const scheduleServerSave = useCallback(
		(data: CanvasData) => {
			if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = setTimeout(() => {
				void persistServerSave(data);
			}, SERVER_SAVE_THROTTLE_MS);
		},
		[persistServerSave],
	);

	// Gate saves until the initial scene has been loaded
	const isInitializedRef = useRef(false);

	// Reset on canvasId change - using useMountEffect with key prop pattern
	// The component using this hook should have canvasId as key to trigger remount
	useMountEffect(() => {
		isInitializedRef.current = false;
		latestSceneRef.current = null;
		latestThumbnailSignatureRef.current = null;
		inFlightThumbnailSignatureRef.current = null;
		coordinatorRef.current?.cancelPendingSave();
		if (serverSaveTimeoutRef.current) {
			clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = null;
		}
	});

	const handleSaveNeeded = useCallback(
		(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
			if (!isInitializedRef.current) return;
			const data = buildPersistedCanvasData(
				elements,
				appState as unknown as Record<string, unknown>,
				files as unknown as Record<string, unknown>,
			);
			latestSceneRef.current = data;
			coordinatorRef.current?.scheduleSave(data, canvasId);
			scheduleServerSave(data);
		},
		[canvasId, scheduleServerSave],
	);

	const normalizeSceneChange = useCallback(
		(
			nextElements: readonly ExcalidrawElement[],
			nextAppState: AppState,
			_nextFiles: BinaryFiles,
			previousElements: readonly ExcalidrawElement[],
		) =>
			normalizeAiVectorGroupResize({
				previousElements,
				nextElements,
				selectedElementIds: (nextAppState.selectedElementIds ?? {}) as Record<string, boolean>,
			}),
		[],
	);

	// Load canvas data from API
	const {
		data: canvasQueryData,
		fetchStatus,
		status,
	} = useQuery({
		queryKey: ['canvas', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!res.ok) throw new Error('Failed to load canvas');
			return res.json();
		},
		refetchOnMount: 'always',
	});

	// Initialize scene once API is ready and query has settled
	useMountEffect(() => {
		if (isInitializedRef.current || !excalidrawApi) return;
		if (shouldWaitForCanvasHydration(status, fetchStatus)) return;

		const localSnapshot = coordinatorRef.current?.loadSnapshotFromStorage(canvasId) ?? null;
		const localSavedAt = localSnapshot?.savedAt ?? 0;
		const remoteUpdatedAt =
			status === 'success' &&
			canvasQueryData &&
			typeof canvasQueryData === 'object' &&
			'canvas' in canvasQueryData &&
			canvasQueryData.canvas &&
			typeof canvasQueryData.canvas === 'object' &&
			'updatedAt' in canvasQueryData.canvas
				? new Date(String(canvasQueryData.canvas.updatedAt)).getTime()
				: 0;
		const shouldUseLocalSnapshot = Boolean(localSnapshot && localSavedAt > remoteUpdatedAt);

		if (status === 'success' && canvasQueryData && !shouldUseLocalSnapshot) {
			const data =
				'data' in canvasQueryData && canvasQueryData.data
					? (canvasQueryData.data as unknown as HydratedCanvasScene)
					: null;
			if (data) {
				const { elements, appState, files } = data;
				const remoteData = buildPersistedCanvasData(
					toSceneElements(elements),
					appState ?? {},
					files ?? null,
				);
				const remoteFiles = toBinaryFiles(files);
				excalidrawApi.updateScene({
					elements: normalizeSceneElements(remoteData.elements as ExcalidrawElement[]),
					appState: toSceneUpdateAppState(remoteData.appState),
				});
				if (Object.keys(remoteFiles).length > 0) {
					excalidrawApi.addFiles(toBinaryFileList(remoteFiles));
				}
				syncAppStoreFromExcalidraw(excalidrawApi);
				latestSceneRef.current = remoteData;
			}
		} else if (localSnapshot) {
			const localData = buildPersistedCanvasData(
				normalizeSceneElements((localSnapshot.canvasData.elements ?? []) as ExcalidrawElement[]),
				localSnapshot.canvasData.appState ?? {},
				localSnapshot.canvasData.files ?? null,
			);
			const localFiles = toBinaryFiles(localData.files);
			excalidrawApi.updateScene({
				elements: normalizeSceneElements(localData.elements as ExcalidrawElement[]),
				appState: toSceneUpdateAppState(localData.appState),
			});
			if (Object.keys(localFiles).length > 0) {
				excalidrawApi.addFiles(toBinaryFileList(localFiles));
			}
			syncAppStoreFromExcalidraw(excalidrawApi);
			latestSceneRef.current = localData;
		}

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				excalidrawApi.refresh();
			});
		});

		isInitializedRef.current = true;
	});

	// Sync latestSceneRef with store changes - using a ref update pattern
	// This is NOT derived state but a ref that needs to track latest for cleanup
	const latestSceneForCleanupRef = useRef<CanvasData | null>(null);
	latestSceneForCleanupRef.current = buildPersistedCanvasData(elements, appState, files);

	// Cleanup on unmount - useMountEffect cleanup function
	useMountEffect(() => {
		const coordinator = coordinatorRef.current;
		return () => {
			const latestData = latestSceneForCleanupRef.current;
			if (isInitializedRef.current && latestData) {
				coordinator?.forceSave(latestData, canvasId);
				void persistServerSave(latestData);
			}
			coordinator?.dispose();
			if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
		};
	});

	return {
		excalidrawApi,
		elements,
		appState,
		files,
		collaboration,
		handleSaveNeeded,
		normalizeSceneChange,
		isInitialized: isInitializedRef.current,
		canvasQueryData,
		status,
	};
}
