import { useCallback, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
import { useAppStore } from '@/stores/store';
import {
	cloneExcalidrawAppState,
	cloneExcalidrawElements,
	cloneExcalidrawFiles,
} from './excalidraw-store-sync';

interface CanvasCoreProps {
	canvasId: string;
	onSaveNeeded?: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
	onSceneChange?: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
	initialData?: ExcalidrawInitialDataState;
	onPointerUpdate?: (payload: {
		pointer: { x: number; y: number };
		button: 'down' | 'up';
		pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
	}) => void;
	/** Called when the user changes the canvas background color via Excalidraw's UI. */
	onBgColorChange?: (color: string) => void;
}

export function CanvasCore({
	canvasId,
	onSaveNeeded,
	onSceneChange,
	initialData,
	onPointerUpdate,
	onBgColorChange,
}: CanvasCoreProps) {
	const setExcalidrawApi = useAppStore((s) => s.setExcalidrawApi);
	const setElements = useAppStore((s) => s.setElements);
	const setAppState = useAppStore((s) => s.setAppState);
	const setFiles = useAppStore((s) => s.setFiles);
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

	const syncLiveSceneFromApi = useCallback(() => {
		const api = apiRef.current;
		if (!api) {
			return;
		}

		const elementSnapshot = cloneExcalidrawElements(api.getSceneElements());
		const appStateSnapshot = cloneExcalidrawAppState(api.getAppState());
		const filesSnapshot = cloneExcalidrawFiles(api.getFiles());

		setElements(elementSnapshot);
		setAppState(appStateSnapshot);
		setFiles(filesSnapshot);
	}, [setAppState, setElements, setFiles]);

	const handleApiReady = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			if (apiRef.current === api) {
				return;
			}
			apiRef.current = api;
			setExcalidrawApi(api);
		},
		[setExcalidrawApi],
	);

	const handleChange = useCallback(
		(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
			// When the user changes the canvas background color, capture the real color and
			// immediately reset the canvas to transparent. This lets HTML overlay divs placed
			// at z-index: 0 remain visible through the canvas wherever no shapes are drawn
			// (transparent canvas pixels), while shapes painted at a higher z-index cover them.
			// The real background color is forwarded to the parent, which renders it as a CSS
			// background div and ensures it is restored correctly when the canvas is saved.
			if (appState.viewBackgroundColor !== 'transparent') {
				onBgColorChange?.(appState.viewBackgroundColor);
				apiRef.current?.updateScene({ appState: { viewBackgroundColor: 'transparent' } });
				// Fall through so elements and files are still synced this frame.
				// The subsequent onChange (triggered by the updateScene above) will re-sync
				// appState with viewBackgroundColor: 'transparent'.
			}

			// Always sync with transparent background to Zustand so saved data stays clean.
			const transparentAppState: AppState = { ...appState, viewBackgroundColor: 'transparent' };
			const elementSnapshot = cloneExcalidrawElements(elements);
			const appStateSnapshot = cloneExcalidrawAppState(transparentAppState);
			const filesSnapshot = cloneExcalidrawFiles(files);

			setElements(elementSnapshot);
			setAppState(appStateSnapshot);
			setFiles(filesSnapshot);
			onSceneChange?.(elementSnapshot, appStateSnapshot, filesSnapshot);
			onSaveNeeded?.(elementSnapshot, appStateSnapshot, filesSnapshot);
		},
		[setElements, setAppState, setFiles, onSaveNeeded, onSceneChange, onBgColorChange],
	);

	const handlePointerUpdate = useCallback(
		(payload: {
			pointer: { x: number; y: number };
			button: 'down' | 'up';
			pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
		}) => {
			const hasActivePointers = payload.button === 'down' || payload.pointersMap.size > 0;
			if (hasActivePointers) {
				syncLiveSceneFromApi();
			}
			onPointerUpdate?.(payload);
		},
		[onPointerUpdate, syncLiveSceneFromApi],
	);

	return (
		<div className="h-full w-full" data-testid="canvas-core">
			<Excalidraw
				excalidrawAPI={handleApiReady}
				initialData={initialData}
				onChange={handleChange}
				onPointerUpdate={handlePointerUpdate}
				UIOptions={{
					canvasActions: {
						loadScene: false,
						export: false,
					},
				}}
			/>
		</div>
	);
}
