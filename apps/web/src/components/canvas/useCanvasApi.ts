import { useAppStore } from '@/stores/store';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback, useRef, useState } from 'react';

interface UseCanvasApiReturn {
	/** The current Excalidraw API instance (from store) */
	api: ExcalidrawImperativeAPI | null;
	/** Ref to the API instance for synchronous access */
	apiRef: React.RefObject<ExcalidrawImperativeAPI | null>;
	/** Callback to initialize the API when Excalidraw is ready */
	initializeApi: (api: ExcalidrawImperativeAPI) => void;
	/** Whether the API is ready for use */
	isApiReady: boolean;
}

/**
 * Manages Excalidraw API instance and availability state.
 *
 * Responsibilities:
 * - Track Excalidraw API ref and state
 * - Provide API initialization callback
 * - Expose API availability flag
 *
 * Anti-slop: No persistence logic, no UI state, no scene sync.
 * Pure API management only.
 */
export function useCanvasApi(): UseCanvasApiReturn {
	const api = useAppStore((s) => s.excalidrawApi);
	const setExcalidrawApi = useAppStore((s) => s.setExcalidrawApi);

	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const [isApiReady, setIsApiReady] = useState(false);

	const initializeApi = useCallback(
		(newApi: ExcalidrawImperativeAPI) => {
			if (apiRef.current === newApi) {
				return;
			}

			apiRef.current = newApi;
			setExcalidrawApi(newApi);
			setIsApiReady(true);
		},
		[setExcalidrawApi],
	);

	return {
		api,
		apiRef,
		initializeApi,
		isApiReady,
	};
}
