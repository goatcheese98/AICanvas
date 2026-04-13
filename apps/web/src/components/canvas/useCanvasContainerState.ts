import { useCollaboration } from '@/hooks/useCollaboration';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { useAppStore } from '@/stores/store';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { buildPersistedCanvasData, readCanvasVersion } from './canvas-persistence-utils';
import { useCanvasInitialization } from './useCanvasInitialization';
import { useCanvasPersistence } from './useCanvasPersistence';
import { useCanvasTools } from './useCanvasTools';

interface UseCanvasContainerStateProps {
	canvasId: string;
}

interface UseCanvasContainerStateReturn {
	collaboration: ReturnType<typeof useCollaboration>;
	handleSaveNeeded: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => void;
	saveCanvasNow: () => Promise<void>;
	normalizeSceneChange: (
		nextElements: readonly ExcalidrawElement[],
		nextAppState: AppState,
		_nextFiles: BinaryFiles,
		previousElements: readonly ExcalidrawElement[],
	) => readonly ExcalidrawElement[] | null;
	isInitialized: boolean;
	canvasQueryData: UseQueryResult['data'];
	status: UseQueryResult['status'];
}

/**
 * Orchestrates canvas state management by composing focused sub-hooks.
 *
 * Sub-hooks:
 * - useCanvasPersistence: local storage + server save coordination
 * - useCanvasInitialization: remote/local snapshot loading
 * - useCanvasTools: scene normalization utilities
 * - useCollaboration: real-time collaboration
 *
 * Anti-slop: This is a thin orchestration layer. All logic lives in sub-hooks.
 */
export function useCanvasContainerState({
	canvasId,
}: UseCanvasContainerStateProps): UseCanvasContainerStateReturn {
	const { getToken } = useAuth();
	const addToast = useAppStore((s) => s.addToast);

	// Store state
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);

	// Persistence and tools
	const persistence = useCanvasPersistence({ canvasId });
	const tools = useCanvasTools();

	// Collaboration
	const collaboration = useCollaboration({
		onError: (message: string) => addToast({ message, type: 'error' }),
	});

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

	const remoteCanvasVersion = readCanvasVersion(canvasQueryData);
	if (remoteCanvasVersion !== null && !persistence.hasVersionConflictRef.current) {
		persistence.canvasVersionRef.current = remoteCanvasVersion;
	}

	// Initialization
	const { isInitialized, isInitializedRef } = useCanvasInitialization({
		canvasId,
		excalidrawApi,
		status: status as 'pending' | 'error' | 'success',
		fetchStatus,
		canvasQueryData,
		loadSnapshot: (id) => persistence.coordinatorRef.current?.loadSnapshotFromStorage(id) ?? null,
		onInitialized: (data) => {
			persistence.latestSceneRef.current = data as ReturnType<typeof buildPersistedCanvasData>;
		},
	});

	// Reset on canvasId change
	useEffect(() => {
		persistence.latestSceneRef.current = null;
		persistence.coordinatorRef.current?.cancelPendingSave();
	}, [canvasId, persistence.coordinatorRef, persistence.latestSceneRef]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			const coordinator = persistence.coordinatorRef.current;
			const latestData = persistence.latestSceneRef.current;
			if (isInitializedRef.current && latestData) {
				coordinator?.forceSave(latestData, canvasId);
				if (persistence.hasPendingServerSaveRef.current) {
					void persistence.forceServerSave(latestData);
				}
			}
			persistence.cleanup();
		};
	}, [
		canvasId,
		isInitializedRef,
		persistence.cleanup,
		persistence.coordinatorRef,
		persistence.forceServerSave,
		persistence.hasPendingServerSaveRef,
		persistence.latestSceneRef,
	]);

	// Save handler
	const handleSaveNeeded = (
		sceneElements: readonly ExcalidrawElement[],
		sceneAppState: AppState,
		sceneFiles: BinaryFiles,
	) => {
		if (!isInitializedRef.current) return;

		const data = buildPersistedCanvasData(
			sceneElements as unknown as Record<string, unknown>[],
			sceneAppState as unknown as Record<string, unknown>,
			sceneFiles as unknown as Record<string, unknown>,
		);

		persistence.latestSceneRef.current = data;
		persistence.coordinatorRef.current?.scheduleSave(data, canvasId);
		persistence.scheduleServerSave(data);
	};

	const saveCanvasNow = useCallback(async () => {
		if (!isInitializedRef.current) {
			addToast({
				message: 'Canvas is still loading. Try again in a moment.',
				type: 'info',
			});
			return;
		}

		const latestData = persistence.latestSceneRef.current;
		if (!latestData) {
			addToast({
				message: 'Nothing to save yet.',
				type: 'info',
			});
			return;
		}

		persistence.coordinatorRef.current?.forceSave(latestData, canvasId);
		const didSave = await persistence.forceServerSave(latestData);
		if (didSave) {
			addToast({
				message: 'Canvas saved.',
				type: 'success',
			});
			return;
		}

		if (!persistence.hasVersionConflictRef.current) {
			addToast({
				message: 'Save failed. Changes remain available locally.',
				type: 'error',
			});
		}
	}, [
		addToast,
		canvasId,
		isInitializedRef,
		persistence.coordinatorRef,
		persistence.forceServerSave,
		persistence.hasVersionConflictRef,
		persistence.latestSceneRef,
	]);

	return {
		collaboration,
		handleSaveNeeded,
		saveCanvasNow,
		normalizeSceneChange: tools.normalizeSceneChange,
		isInitialized,
		canvasQueryData,
		status,
	};
}
