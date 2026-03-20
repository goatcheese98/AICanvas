import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { useCallback, useRef } from 'react';

import { normalizeAiVectorGroupResize } from './ai-vector-resize-normalizer';

interface UseCanvasToolsReturn {
	/** Normalize scene changes for AI vector group resize */
	normalizeSceneChange: (
		nextElements: readonly ExcalidrawElement[],
		nextAppState: AppState,
		_nextFiles: BinaryFiles,
		previousElements: readonly ExcalidrawElement[],
	) => readonly ExcalidrawElement[] | null;
	/** Ref to track if normalization is being applied */
	isApplyingNormalizedSceneRef: React.RefObject<boolean>;
	/** Ref to store previous elements for comparison */
	previousElementsRef: React.RefObject<readonly ExcalidrawElement[]>;
}

/**
 * Manages canvas tool utilities and scene normalization.
 *
 * Responsibilities:
 * - AI vector group resize normalization
 * - Scene change tracking refs
 * - Tool-specific scene transformations
 *
 * Anti-slop: No persistence logic, no API management, no direct UI state.
 * Pure tool/scene coordination only.
 */
export function useCanvasTools(): UseCanvasToolsReturn {
	const isApplyingNormalizedSceneRef = useRef(false);
	const previousElementsRef = useRef<readonly ExcalidrawElement[]>([]);

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

	return {
		normalizeSceneChange,
		isApplyingNormalizedSceneRef,
		previousElementsRef,
	};
}
