import { useCallback, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useAppStore } from '@/stores/store';

interface CanvasCoreProps {
	canvasId: string;
	onSaveNeeded?: (elements: readonly ExcalidrawElement[], appState: any, files: any) => void;
	onSceneChange?: (elements: readonly ExcalidrawElement[], appState: any, files: any) => void;
	onPointerUpdate?: (payload: {
		pointer: { x: number; y: number };
		button: 'down' | 'up';
		pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
	}) => void;
}

function createElementsSnapshot(elements: readonly ExcalidrawElement[]) {
	return [...elements];
}

function createAppStateSnapshot(appState: any) {
	return {
		...appState,
		selectedElementIds: { ...(appState?.selectedElementIds ?? {}) },
		zoom:
			appState?.zoom && typeof appState.zoom === 'object'
				? { ...appState.zoom }
				: appState?.zoom,
	};
}

function createFilesSnapshot(files: any) {
	return files && typeof files === 'object' ? { ...files } : files;
}

export function CanvasCore({ canvasId, onSaveNeeded, onSceneChange, onPointerUpdate }: CanvasCoreProps) {
	const setExcalidrawApi = useAppStore((s) => s.setExcalidrawApi);
	const setElements = useAppStore((s) => s.setElements);
	const setAppState = useAppStore((s) => s.setAppState);
	const setFiles = useAppStore((s) => s.setFiles);
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

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
		(elements: readonly ExcalidrawElement[], appState: any, files: any) => {
			const elementSnapshot = createElementsSnapshot(elements);
			const appStateSnapshot = createAppStateSnapshot(appState);
			const filesSnapshot = createFilesSnapshot(files);

			setElements(elementSnapshot);
			setAppState(appStateSnapshot);
			setFiles(filesSnapshot);
			onSceneChange?.(elementSnapshot, appStateSnapshot, filesSnapshot);
			onSaveNeeded?.(elementSnapshot, appStateSnapshot, filesSnapshot);
		},
		[setElements, setAppState, setFiles, onSaveNeeded, onSceneChange],
	);

	return (
		<div className="h-full w-full">
			<Excalidraw
				excalidrawAPI={handleApiReady}
				onChange={handleChange}
				onPointerUpdate={onPointerUpdate}
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
