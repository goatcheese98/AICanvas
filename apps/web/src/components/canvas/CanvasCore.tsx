import { useMountEffect } from '@/hooks/useMountEffect';
import {
	areBinaryFilesEquivalent,
	areExcalidrawAppStatesEquivalent,
	areExcalidrawElementsEquivalent,
} from '@/lib/excalidraw-scene-equality';
import { useAppStore } from '@/stores/store';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type {
	AppState,
	BinaryFiles,
	ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import { useCallback, useRef } from 'react';
import {
	cloneExcalidrawAppState,
	cloneExcalidrawElements,
	cloneExcalidrawFiles,
} from './excalidraw-store-sync';

const CANVAS_UI_OPTIONS = {
	canvasActions: {
		loadScene: false,
		export: false,
	},
} as const;

interface CanvasCoreProps {
	canvasId: string;
	onSaveNeeded?: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => void;
	onSceneChange?: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => void;
	normalizeSceneChange?: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
		previousElements: readonly ExcalidrawElement[],
	) => readonly ExcalidrawElement[] | null;
	initialData?: ExcalidrawInitialDataState;
	onPointerUpdate?: (payload: {
		pointer: { x: number; y: number };
		button: 'down' | 'up';
		pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
	}) => void;
}

export function CanvasCore({
	canvasId: _canvasId,
	onSaveNeeded,
	onSceneChange,
	normalizeSceneChange,
	initialData,
	onPointerUpdate,
}: CanvasCoreProps) {
	const setExcalidrawApi = useAppStore((s) => s.setExcalidrawApi);
	const setElements = useAppStore((s) => s.setElements);
	const setAppState = useAppStore((s) => s.setAppState);
	const setFiles = useAppStore((s) => s.setFiles);
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const isApplyingNormalizedSceneRef = useRef(false);
	const previousElementsRef = useRef<readonly ExcalidrawElement[]>([]);

	const syncLiveAppStateFromApi = useCallback(() => {
		const api = apiRef.current;
		if (!api) {
			return;
		}

		const appStateSnapshot = cloneExcalidrawAppState(api.getAppState());
		const currentAppState = useAppStore.getState().appState;
		if (!areExcalidrawAppStatesEquivalent(currentAppState, appStateSnapshot)) {
			setAppState(appStateSnapshot);
		}
	}, [setAppState]);

	const handleApiReady = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			if (apiRef.current === api) {
				return;
			}
			apiRef.current = api;
			queueMicrotask(() => {
				if (apiRef.current === api) {
					setExcalidrawApi(api);
				}
			});
		},
		[setExcalidrawApi],
	);

	useMountEffect(() => {
		return () => {
			apiRef.current = null;
			setExcalidrawApi(null);
		};
	});

	const handleChange = useCallback(
		(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
			if (isApplyingNormalizedSceneRef.current) {
				isApplyingNormalizedSceneRef.current = false;
			} else {
				const normalizedElements = normalizeSceneChange?.(
					elements,
					appState,
					files,
					previousElementsRef.current,
				);
				if (
					normalizedElements &&
					apiRef.current &&
					!areExcalidrawElementsEquivalent(normalizedElements, elements)
				) {
					isApplyingNormalizedSceneRef.current = true;
					apiRef.current.updateScene({
						elements: normalizedElements,
						appState: {
							selectedElementIds: appState.selectedElementIds,
						},
					});
					return;
				}
			}

			const elementSnapshot = cloneExcalidrawElements(elements);
			const appStateSnapshot = cloneExcalidrawAppState(appState);
			const filesSnapshot = cloneExcalidrawFiles(files);
			previousElementsRef.current = elementSnapshot;

			const currentState = useAppStore.getState();
			const hasElementChange = !areExcalidrawElementsEquivalent(
				currentState.elements,
				elementSnapshot,
			);
			const hasAppStateChange = !areExcalidrawAppStatesEquivalent(
				currentState.appState,
				appStateSnapshot,
			);
			const hasFileChange = !areBinaryFilesEquivalent(currentState.files, filesSnapshot);

			if (!hasElementChange && !hasAppStateChange && !hasFileChange) {
				return;
			}

			if (hasElementChange) {
				setElements(elementSnapshot);
			}
			if (hasAppStateChange) {
				setAppState(appStateSnapshot);
			}
			if (hasFileChange) {
				setFiles(filesSnapshot);
			}
			onSceneChange?.(elementSnapshot, appStateSnapshot, filesSnapshot);
			onSaveNeeded?.(elementSnapshot, appStateSnapshot, filesSnapshot);
		},
		[normalizeSceneChange, setElements, setAppState, setFiles, onSaveNeeded, onSceneChange],
	);

	const handlePointerUpdate = useCallback(
		(payload: {
			pointer: { x: number; y: number };
			button: 'down' | 'up';
			pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
		}) => {
			const hasActivePointers = payload.button === 'down' || payload.pointersMap.size > 0;
			if (hasActivePointers) {
				syncLiveAppStateFromApi();
			}
			onPointerUpdate?.(payload);
		},
		[onPointerUpdate, syncLiveAppStateFromApi],
	);

	return (
		<div className="h-full w-full" data-testid="canvas-core">
			<Excalidraw
				excalidrawAPI={handleApiReady}
				initialData={initialData}
				onChange={handleChange}
				onPointerUpdate={handlePointerUpdate}
				UIOptions={CANVAS_UI_OPTIONS}
			/>
		</div>
	);
}
