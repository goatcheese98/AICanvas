import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { CanvasCore } from './CanvasCore';
import { CanvasUI } from './CanvasUI';
import { CanvasNotesLayer } from './CanvasNotesLayer';
import { useAppStore } from '@/stores/store';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { useCollaboration } from '@/hooks/useCollaboration';
import {
	CanvasPersistenceCoordinator,
	type CanvasData,
} from '@/lib/persistence/CanvasPersistenceCoordinator';
import {
	buildPersistedCanvasData,
	shouldWaitForCanvasHydration,
} from './canvas-persistence-utils';
import { normalizeSceneElements } from './scene-element-normalizer';

const SERVER_SAVE_THROTTLE_MS = 5000;

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
					queryClient.invalidateQueries({ queryKey: ['canvas-preview', canvasId] }),
					queryClient.invalidateQueries({ queryKey: ['canvases'] }),
				]);
			} catch (err) {
				console.error('Server auto-save failed:', err);
			}
		},
		[canvasId, getToken, queryClient],
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
		coordinatorRef.current?.cancelPendingSave();
		if (serverSaveTimeoutRef.current) {
			clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = null;
		}
	}, [canvasId]);

	const handleSaveNeeded = useCallback(
		(elements: readonly any[], appState: any, files: any) => {
			if (!isInitializedRef.current) return;
			const data = buildPersistedCanvasData(elements, appState, files);
			latestSceneRef.current = data;
			coordinatorRef.current?.scheduleSave(data, canvasId);
			scheduleServerSave(data);
		},
		[canvasId, scheduleServerSave],
	);

	const handleOverlaySceneChange = useCallback(
		(nextElements: readonly ExcalidrawElement[]) => {
			if (!isInitializedRef.current) return;
			const nextData = buildPersistedCanvasData(
				nextElements,
				excalidrawApi?.getAppState() ?? appState,
				(excalidrawApi?.getFiles() as Record<string, unknown> | null | undefined) ?? files,
			);
			latestSceneRef.current = nextData;
			coordinatorRef.current?.scheduleSave(nextData, canvasId);
			scheduleServerSave(nextData);
		},
		[appState, canvasId, excalidrawApi, files, scheduleServerSave],
	);

	// Load canvas data from API
	const { data: canvasQueryData, fetchStatus, status } = useQuery({
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

		if (status === 'success' && canvasQueryData?.data) {
			const { elements, appState, files } = canvasQueryData.data as any;
			const remoteData = buildPersistedCanvasData(
				normalizeSceneElements((elements ?? []) as ExcalidrawElement[]),
				appState ?? {},
				files ?? null,
			);
			excalidrawApi.updateScene({
				elements: remoteData.elements,
				appState: remoteData.appState as any,
			});
			if (files && Object.keys(files).length > 0) {
				excalidrawApi.addFiles(Object.values(files) as any[]);
			}
			latestSceneRef.current = remoteData;
		} else {
			// API failed or returned no data — fall back to localStorage
			const local = coordinatorRef.current?.loadFromStorage(canvasId);
			if (local) {
				const localData = buildPersistedCanvasData(
					normalizeSceneElements((local.elements ?? []) as ExcalidrawElement[]),
					local.appState ?? {},
					local.files ?? null,
				);
				excalidrawApi.updateScene({
					elements: localData.elements,
					appState: localData.appState as any,
				});
				if (localData.files && Object.keys(localData.files).length > 0) {
					excalidrawApi.addFiles(Object.values(localData.files) as any[]);
				}
				latestSceneRef.current = localData;
			}
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
			{excalidrawApi && <CanvasNotesLayer onOverlaySceneChange={handleOverlaySceneChange} />}
			<CanvasUI canvasId={canvasId} collaboration={collaboration} />
		</div>
	);
}
