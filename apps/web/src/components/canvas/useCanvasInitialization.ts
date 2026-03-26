import { useMountEffect } from '@/hooks/useMountEffect';
import type { CanvasStorageSnapshot } from '@/lib/persistence/CanvasPersistenceCoordinator';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useRef } from 'react';

import {
	toBinaryFileList,
	toBinaryFiles,
	toSceneElements,
	toSceneUpdateAppState,
} from './canvas-container-utils';
import { buildPersistedCanvasData, shouldWaitForCanvasHydration } from './canvas-persistence-utils';
import { syncAppStoreFromExcalidraw } from './excalidraw-store-sync';
import { normalizeSceneElements } from './scene-element-normalizer';

type QueryStatus = 'pending' | 'error' | 'success';
type FetchStatus = 'fetching' | 'paused' | 'idle';

type HydratedCanvasScene = {
	elements?: readonly Record<string, unknown>[] | null;
	appState?: Record<string, unknown> | null;
	files?: Record<string, unknown> | null;
};

interface UseCanvasInitializationProps {
	canvasId: string;
	excalidrawApi: ExcalidrawImperativeAPI | null;
	status: QueryStatus;
	fetchStatus: FetchStatus;
	canvasQueryData: unknown;
	loadSnapshot: (canvasId: string) => CanvasStorageSnapshot | null;
	onInitialized: (data: { elements: unknown[]; appState: unknown; files: unknown }) => void;
}

interface UseCanvasInitializationReturn {
	/** Whether the canvas has been initialized with data */
	isInitialized: boolean;
	/** Ref to isInitialized for synchronous access */
	isInitializedRef: React.RefObject<boolean>;
}

/**
 * Manages canvas initialization from remote or local snapshot.
 *
 * Responsibilities:
 * - Prefer remote API data when it exists
 * - Fall back to localStorage only when remote data is unavailable
 * - Sync app store after initialization
 * - Refresh Excalidraw after scene load
 *
 * Anti-slop: No persistence logic, no UI state, no ongoing sync.
 * Pure initialization coordination only.
 */
export function useCanvasInitialization({
	canvasId,
	excalidrawApi,
	status,
	fetchStatus,
	canvasQueryData,
	loadSnapshot,
	onInitialized,
}: UseCanvasInitializationProps): UseCanvasInitializationReturn {
	const isInitializedRef = useRef(false);

	useMountEffect(() => {
		isInitializedRef.current = false;
	});

	useMountEffect(() => {
		if (isInitializedRef.current || !excalidrawApi) return;
		if (shouldWaitForCanvasHydration(status, fetchStatus)) return;

		const localSnapshot = loadSnapshot(canvasId) ?? null;

		if (status === 'success' && canvasQueryData) {
			const data =
				typeof canvasQueryData === 'object' && 'data' in canvasQueryData && canvasQueryData.data
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
					elements: normalizeSceneElements(remoteData.elements as never[]),
					appState: toSceneUpdateAppState(remoteData.appState),
				});
				if (Object.keys(remoteFiles).length > 0) {
					excalidrawApi.addFiles(toBinaryFileList(remoteFiles));
				}
				syncAppStoreFromExcalidraw(excalidrawApi);
				onInitialized(remoteData);
			}
		} else if (localSnapshot) {
			const localData = buildPersistedCanvasData(
				normalizeSceneElements((localSnapshot.canvasData.elements ?? []) as never[]),
				localSnapshot.canvasData.appState ?? {},
				localSnapshot.canvasData.files ?? null,
			);
			const localFiles = toBinaryFiles(localData.files);
			excalidrawApi.updateScene({
				elements: normalizeSceneElements(localData.elements as never[]),
				appState: toSceneUpdateAppState(localData.appState),
			});
			if (Object.keys(localFiles).length > 0) {
				excalidrawApi.addFiles(toBinaryFileList(localFiles));
			}
			syncAppStoreFromExcalidraw(excalidrawApi);
			onInitialized(localData);
		}

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				excalidrawApi.refresh();
			});
		});

		isInitializedRef.current = true;
	});

	return {
		isInitialized: isInitializedRef.current,
		isInitializedRef,
	};
}
