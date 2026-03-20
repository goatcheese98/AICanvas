import {
	cloneExcalidrawAppState,
	syncAppStoreFromExcalidraw,
	updateSceneAndSyncAppStore,
} from '@/components/canvas/excalidraw-store-sync';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFileData, BinaryFiles, Collaborator, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ApplySceneSnapshotOptions, CameraTarget, CanvasSceneSnapshot } from '../tour-types';

function cloneAppState(appState: Partial<AppState>): Partial<AppState> {
	return cloneExcalidrawAppState(appState);
}

function getCollaborators(): Map<string, Collaborator> {
	return new Map();
}

interface UseTourSceneCaptureArgs {
	excalidrawApiRef: React.MutableRefObject<ExcalidrawImperativeAPI | null>;
	cameraRef: React.MutableRefObject<CameraTarget>;
	viewportSize: { width: number; height: number };
	imageFileData: BinaryFileData | null;
	createCameraFromAppState: (appState: Partial<AppState>) => CameraTarget;
	buildGuideAppState: (targetCamera: CameraTarget) => Partial<AppState>;
	buildExploreAppState: (targetCamera: CameraTarget) => Partial<AppState>;
	setLiveCamera: (camera: CameraTarget) => void;
	isGuideMode: boolean;
	guideBaseline: {
		elements: ExcalidrawElement[];
		camera: CameraTarget;
	};
}

interface UseTourSceneCaptureReturn {
	exploreSessionRef: React.MutableRefObject<CanvasSceneSnapshot | null>;
	exploreSessionVersion: number;
	setExploreSessionSnapshot: (snapshot: CanvasSceneSnapshot | null) => void;
	getExploreSessionSnapshot: () => CanvasSceneSnapshot | null;
	getCurrentSceneSnapshot: () => CanvasSceneSnapshot;
	applySceneSnapshot: (snapshot: CanvasSceneSnapshot, options?: ApplySceneSnapshotOptions) => void;
	initialSurfaceData: { elements: ExcalidrawElement[]; appState: Partial<AppState> };
}

export function useTourSceneCapture({
	excalidrawApiRef,
	cameraRef,
	viewportSize,
	imageFileData,
	createCameraFromAppState,
	buildGuideAppState,
	buildExploreAppState,
	setLiveCamera,
	isGuideMode,
	guideBaseline,
}: UseTourSceneCaptureArgs): UseTourSceneCaptureReturn {
	const exploreSessionRef = useRef<CanvasSceneSnapshot | null>(null);
	const [exploreSessionVersion, setExploreSessionVersion] = useState(0);

	const getCurrentSceneSnapshot = useCallback((): CanvasSceneSnapshot => {
		const api = excalidrawApiRef.current;
		if (api) {
			return {
				elements: normalizeSceneElements([
					...(api.getSceneElementsIncludingDeleted() as readonly ExcalidrawElement[]),
				]),
				appState: cloneAppState(api.getAppState() as Partial<AppState>),
				files: { ...api.getFiles() },
			};
		}

		const store = useAppStore.getState();
		return {
			elements: normalizeSceneElements([...(store.elements as ExcalidrawElement[])]),
			appState: cloneAppState(store.appState),
			files: { ...store.files },
		};
	}, [excalidrawApiRef]);

	const applySceneSnapshot = useCallback(
		(snapshot: CanvasSceneSnapshot, options?: ApplySceneSnapshotOptions) => {
			const api = excalidrawApiRef.current;
			if (!api) return;

			const baseAppState = cloneAppState(snapshot.appState);
			const nextAppState = options?.cameraOverride
				? {
						...baseAppState,
						...getViewportAppState(options.cameraOverride, viewportSize.width, viewportSize.height),
					}
				: baseAppState;

			if (!options?.preserveSelection) {
				nextAppState.selectedElementIds = {};
				nextAppState.openMenu = null;
				nextAppState.openPopup = null;
				nextAppState.openSidebar = null;
				nextAppState.openDialog = null;
				nextAppState.contextMenu = null;
				nextAppState.editingTextElement = null;
				nextAppState.editingLinearElement = null;
				nextAppState.activeEmbeddable = null;
			}
			if (typeof options?.cameraOverride !== 'undefined') {
				nextAppState.width = viewportSize.width;
				nextAppState.height = viewportSize.height;
			}

			api.updateScene({
				elements: snapshot.elements,
				appState: nextAppState as never,
				collaborators: getCollaborators() as never,
			});
			const filesToAdd = [
				...Object.values(snapshot.files),
				...(imageFileData ? [imageFileData] : []),
			];
			if (filesToAdd.length > 0) {
				api.addFiles(filesToAdd);
			}
			syncAppStoreFromExcalidraw(api);
			const nextCamera = createCameraFromAppState(nextAppState);
			cameraRef.current = nextCamera;
			setLiveCamera(nextCamera);
		},
		[
			excalidrawApiRef,
			cameraRef,
			createCameraFromAppState,
			imageFileData,
			viewportSize.height,
			viewportSize.width,
			setLiveCamera,
		],
	);

	const setExploreSessionSnapshot = useCallback((snapshot: CanvasSceneSnapshot | null) => {
		exploreSessionRef.current = snapshot;
		setExploreSessionVersion((current) => current + 1);
	}, []);

	const getExploreSessionSnapshot = useCallback(() => exploreSessionRef.current, []);

	const initialSurfaceData = useMemo(() => {
		if (isGuideMode) {
			return {
				elements: guideBaseline.elements,
				appState: buildGuideAppState(guideBaseline.camera),
			};
		}

		const exploreSession = exploreSessionRef.current;
		if (exploreSession) {
			return {
				elements: exploreSession.elements,
				appState: {
					...exploreSession.appState,
					viewBackgroundColor: '#f7f8fb',
					viewModeEnabled: false,
				},
			};
		}

		return {
			elements: guideBaseline.elements,
			appState: buildExploreAppState(guideBaseline.camera),
		};
	}, [
		buildExploreAppState,
		buildGuideAppState,
		isGuideMode,
		guideBaseline.camera,
		guideBaseline.elements,
		exploreSessionVersion,
	]);

	return useMemo(
		() => ({
			exploreSessionRef,
			exploreSessionVersion,
			setExploreSessionSnapshot,
			getExploreSessionSnapshot,
			getCurrentSceneSnapshot,
			applySceneSnapshot,
			initialSurfaceData,
		}),
		[
			exploreSessionVersion,
			setExploreSessionSnapshot,
			getExploreSessionSnapshot,
			getCurrentSceneSnapshot,
			applySceneSnapshot,
			initialSurfaceData,
		],
	);
}

function getViewportAppState(target: CameraTarget, width: number, height: number) {
	const zoom = target.zoom;

	return {
		scrollX: width / (2 * zoom) - target.x,
		scrollY: height / (2 * zoom) - target.y,
		zoom: { value: zoom as never },
	};
}
