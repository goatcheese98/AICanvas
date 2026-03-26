import { useMountEffect } from '@/hooks/useMountEffect';
import type {
	CanvasData,
	CanvasStorageSnapshot,
} from '@/lib/persistence/CanvasPersistenceCoordinator';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { useCallback, useRef } from 'react';

import { buildPersistedCanvasData } from './canvas-persistence-utils';

interface UseCanvasSceneSyncProps {
	canvasId: string;
	isInitializedRef: React.RefObject<boolean>;
	coordinatorLoadSnapshot: (canvasId: string) => CanvasStorageSnapshot | null;
}

interface UseCanvasSceneSyncReturn {
	/** Whether scene has changes since last save */
	hasChanges: boolean;
	/** Get current scene snapshot from store */
	getSceneSnapshot: () => CanvasData;
	/** Build CanvasData from elements/appState/files */
	buildCanvasData: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => CanvasData;
}

/**
 * Manages scene change tracking and snapshot management.
 *
 * Responsibilities:
 * - Track if scene has unsaved changes
 * - Build consistent CanvasData snapshots
 * - Provide scene data utilities
 *
 * Anti-slop: No persistence logic, no API management, no UI state.
 * Pure scene data coordination only.
 */
export function useCanvasSceneSync({
	canvasId: _canvasId,
	isInitializedRef,
	coordinatorLoadSnapshot: _coordinatorLoadSnapshot,
}: UseCanvasSceneSyncProps): UseCanvasSceneSyncReturn {
	const elements = useAppStore((s) => s.elements);
	const appState = useAppStore((s) => s.appState);
	const files = useAppStore((s) => s.files);

	// Track if we have changes (initialized and have data)
	const hasChangesRef = useRef(false);

	// Get current scene snapshot from store state
	const getSceneSnapshot = useCallback((): CanvasData => {
		return buildPersistedCanvasData(elements, appState, files);
	}, [elements, appState, files]);

	// Build CanvasData from raw scene data
	const buildCanvasData = useCallback(
		(
			sceneElements: readonly ExcalidrawElement[],
			sceneAppState: AppState,
			sceneFiles: BinaryFiles,
		): CanvasData => {
			return buildPersistedCanvasData(
				sceneElements as unknown as Record<string, unknown>[],
				sceneAppState as unknown as Record<string, unknown>,
				sceneFiles as unknown as Record<string, unknown>,
			);
		},
		[],
	);

	// Reset hasChanges when canvasId changes
	useMountEffect(() => {
		hasChangesRef.current = false;
		return () => {
			hasChangesRef.current = false;
		};
	});

	// Update hasChanges based on initialization
	// Note: Actual change detection happens in handleSaveNeeded when data flows through
	const hasChanges = isInitializedRef.current && hasChangesRef.current;

	return {
		hasChanges,
		getSceneSnapshot,
		buildCanvasData,
	};
}
