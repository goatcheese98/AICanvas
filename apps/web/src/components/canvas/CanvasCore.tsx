import { useMountEffect } from '@/hooks/useMountEffect';
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

function areElementPointSetsEqual(left: unknown, right: unknown) {
	return (
		Array.isArray(left) &&
		Array.isArray(right) &&
		left.length === right.length &&
		left.every((entry, index) => {
			if (
				!Array.isArray(entry) ||
				!Array.isArray(right[index]) ||
				entry.length < 2 ||
				right[index].length < 2
			) {
				return false;
			}
			return entry[0] === right[index][0] && entry[1] === right[index][1];
		})
	);
}

function areElementsEquivalent(
	left: readonly ExcalidrawElement[],
	right: readonly ExcalidrawElement[],
) {
	return (
		left.length === right.length &&
		left.every((element, index) => {
			const other = right[index];
			if (!other || element.id !== other.id || element.type !== other.type) {
				return false;
			}
			if (
				element.x !== other.x ||
				element.y !== other.y ||
				element.width !== other.width ||
				element.height !== other.height ||
				element.strokeWidth !== other.strokeWidth
			) {
				return false;
			}
			const leftPoints = (element as ExcalidrawElement & { points?: unknown }).points;
			const rightPoints = (other as ExcalidrawElement & { points?: unknown }).points;
			if (leftPoints || rightPoints) {
				return areElementPointSetsEqual(leftPoints, rightPoints);
			}
			return true;
		})
	);
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
		setAppState(appStateSnapshot);
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
					!areElementsEquivalent(normalizedElements, elements)
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

			setElements(elementSnapshot);
			setAppState(appStateSnapshot);
			setFiles(filesSnapshot);
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
