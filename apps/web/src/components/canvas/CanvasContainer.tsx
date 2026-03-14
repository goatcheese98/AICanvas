import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	AppState,
	BinaryFiles,
	BinaryFileData,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { CanvasCore } from './CanvasCore';
import { CanvasUI } from './CanvasUI';
import { CanvasNotesLayer } from './CanvasNotesLayer';
import { useAppStore } from '@/stores/store';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { useCollaboration } from '@/hooks/useCollaboration';
import { captureBrowserException } from '@/lib/observability';
import {
	CanvasPersistenceCoordinator,
	type CanvasData,
} from '@/lib/persistence/CanvasPersistenceCoordinator';
import { buildPersistedCanvasData, shouldWaitForCanvasHydration } from './canvas-persistence-utils';
import { normalizeSceneElements } from './scene-element-normalizer';

const SERVER_SAVE_THROTTLE_MS = 5000;
const THUMBNAIL_MIME_TYPE = 'image/png';

type HydratedCanvasScene = {
	elements?: readonly Record<string, unknown>[] | null;
	appState?: Record<string, unknown> | null;
	files?: BinaryFiles | null;
};

type SceneUpdateAppState = NonNullable<
	Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['appState']
>;

let exportToBlobLoader: Promise<typeof import('@excalidraw/excalidraw')['exportToBlob']> | null =
	null;

async function getExportToBlob() {
	if (!exportToBlobLoader) {
		exportToBlobLoader = import('@excalidraw/excalidraw').then((module) => module.exportToBlob);
	}
	return exportToBlobLoader;
}

function toSceneUpdateAppState(appState: Record<string, unknown> | null | undefined): SceneUpdateAppState {
	return (appState ?? {}) as SceneUpdateAppState;
}

function toBinaryFiles(files: BinaryFiles | Record<string, unknown> | null | undefined): BinaryFiles {
	return (files ?? {}) as BinaryFiles;
}

function toBinaryFileList(
	files: BinaryFiles | Record<string, unknown> | null | undefined,
): BinaryFileData[] {
	return Object.values(toBinaryFiles(files));
}

function toSceneElements(
	elements: readonly Record<string, unknown>[] | null | undefined,
): ExcalidrawElement[] {
	return normalizeSceneElements((elements ?? []) as unknown as ExcalidrawElement[]);
}

function getThumbnailSignature(data: CanvasData): string {
	return JSON.stringify(
		data.elements.map((element: Record<string, unknown>) => [
			element.id,
			element.version,
			element.versionNonce,
			element.isDeleted === true,
		]),
	);
}

interface CanvasContainerProps {
	canvasId: string;
}

export function CanvasContainer({ canvasId }: CanvasContainerProps) {
	const { getToken } = useAuth();
	const queryClient = useQueryClient();
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const elements = useAppStore((s) => s.elements);
	const appState = useAppStore((s) => s.appState);
	const files = useAppStore((s) => s.files);
	const setPersistenceState = useAppStore((s) => s.setPersistenceState);
	const addToast = useAppStore((s) => s.addToast);

	const collaboration = useCollaboration({
		onError: (message) => addToast({ message, type: 'error' }),
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

			const elements = data.elements.filter(
				(element) => (element as Record<string, unknown>).isDeleted !== true,
			);
			if (elements.length === 0) return;

			inFlightThumbnailSignatureRef.current = signature;

			try {
				const exportToBlob = await getExportToBlob();
				const blob = await exportToBlob({
					elements: elements as never,
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
				const response = await fetch(`/api/canvas/${canvasId}/thumbnail`, {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': THUMBNAIL_MIME_TYPE,
					},
					body: blob,
				});

				if (!response.ok) {
					throw new Error(await response.text());
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

	useEffect(() => {
		isInitializedRef.current = false;
		latestSceneRef.current = null;
		latestThumbnailSignatureRef.current = null;
		inFlightThumbnailSignatureRef.current = null;
		coordinatorRef.current?.cancelPendingSave();
		if (serverSaveTimeoutRef.current) {
			clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = null;
		}
	}, [canvasId]);

	const handleSaveNeeded = useCallback(
		(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
			if (!isInitializedRef.current) return;
			const data = buildPersistedCanvasData(elements, appState as unknown as Record<string, unknown>, files as unknown as Record<string, unknown>);
			latestSceneRef.current = data;
			coordinatorRef.current?.scheduleSave(data, canvasId);
			scheduleServerSave(data);
		},
		[canvasId, scheduleServerSave],
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
	useEffect(() => {
		if (isInitializedRef.current || !excalidrawApi) return;
		if (shouldWaitForCanvasHydration(status, fetchStatus)) return;

		const localSnapshot = coordinatorRef.current?.loadSnapshotFromStorage(canvasId) ?? null;
		const localSavedAt = localSnapshot?.savedAt ?? 0;
		const remoteUpdatedAt =
			status === 'success' && canvasQueryData?.canvas?.updatedAt
				? new Date(canvasQueryData.canvas.updatedAt).getTime()
				: 0;
			const shouldUseLocalSnapshot = Boolean(localSnapshot && localSavedAt > remoteUpdatedAt);

			if (status === 'success' && canvasQueryData?.data && !shouldUseLocalSnapshot) {
				const { elements, appState, files } = canvasQueryData.data as unknown as HydratedCanvasScene;
				const remoteData = buildPersistedCanvasData(
					toSceneElements(elements),
					appState ?? {},
					files ?? null,
				);
				const remoteFiles = toBinaryFiles(files);
				excalidrawApi.updateScene({
					elements: remoteData.elements,
					appState: toSceneUpdateAppState(remoteData.appState),
				});
				if (Object.keys(remoteFiles).length > 0) {
					excalidrawApi.addFiles(toBinaryFileList(remoteFiles));
				}
				latestSceneRef.current = remoteData;
			} else if (localSnapshot) {
				const localData = buildPersistedCanvasData(
					normalizeSceneElements((localSnapshot.canvasData.elements ?? []) as ExcalidrawElement[]),
					localSnapshot.canvasData.appState ?? {},
					localSnapshot.canvasData.files ?? null,
				);
				const localFiles = toBinaryFiles(localData.files);
				excalidrawApi.updateScene({
					elements: localData.elements,
					appState: toSceneUpdateAppState(localData.appState),
				});
				if (Object.keys(localFiles).length > 0) {
					excalidrawApi.addFiles(toBinaryFileList(localFiles));
				}
				latestSceneRef.current = localData;
			}

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				excalidrawApi.refresh();
			});
		});

		isInitializedRef.current = true;
	}, [canvasId, canvasQueryData, excalidrawApi, fetchStatus, status]);

	useEffect(() => {
		if (!isInitializedRef.current) return;
		latestSceneRef.current = buildPersistedCanvasData(elements, appState, files);
	}, [appState, elements, files]);

	// Cleanup on unmount
	useEffect(() => {
		const coordinator = coordinatorRef.current;
		return () => {
			const latestData = latestSceneRef.current;
			if (isInitializedRef.current && latestData) {
				coordinator?.forceSave(latestData, canvasId);
				void persistServerSave(latestData);
			}
			coordinator?.dispose();
			if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
		};
	}, [canvasId, persistServerSave]);

	return (
		<div className="relative h-full w-full overflow-hidden">
			<CanvasCore
				canvasId={canvasId}
				onSaveNeeded={handleSaveNeeded}
				onSceneChange={collaboration.handleSceneChange}
				onPointerUpdate={collaboration.handlePointerUpdate}
			/>
			{excalidrawApi && <CanvasNotesLayer />}
			<CanvasUI canvasId={canvasId} collaboration={collaboration} />
		</div>
	);
}
