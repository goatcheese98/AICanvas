import {
	cloneExcalidrawAppState,
	updateSceneAndSyncAppStore,
} from '@/components/canvas/excalidraw-store-sync';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { useMountEffect } from '@/hooks/useMountEffect';
import { captureBrowserException } from '@/lib/observability';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	AppState,
	BinaryFileData,
	BinaryFiles,
	Collaborator,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { useCallback, useRef, useState } from 'react';
import { useTourCamera, useTourSceneCapture, useTourToolManager } from './hooks';
import {
	type ApplySceneSnapshotOptions,
	type CameraTarget,
	type CanvasSceneSnapshot,
	type CanvasTourDefaultScene,
	type TourTool,
	getTourTool,
} from './tour-types';

export type {
	ApplySceneSnapshotOptions,
	CameraTarget,
	CanvasSceneSnapshot,
	CanvasTourDefaultScene,
	TourTool,
};
export { getTourTool };

interface UseCanvasTourSceneControllerArgs {
	imageId: BinaryFileData['id'];
	defaultScene: CanvasTourDefaultScene;
	stageViewportRef: React.RefObject<HTMLDivElement | null>;
	guideBaseline: {
		elements: ExcalidrawElement[];
		camera: CameraTarget;
	};
	initialCamera: CameraTarget;
	isGuideMode: boolean;
	surfaceEpoch: number;
	setActiveTool: (tool: TourTool) => void;
}

function cloneAppState(appState: Partial<AppState>): Partial<AppState> {
	return cloneExcalidrawAppState(appState);
}

function getCollaborators(): Map<string, Collaborator> {
	return new Map();
}

export function useCanvasTourSceneController({
	imageId,
	defaultScene,
	guideBaseline,
	initialCamera,
	isGuideMode,
	surfaceEpoch,
	setActiveTool,
	stageViewportRef,
}: UseCanvasTourSceneControllerArgs) {
	const setExcalidrawApi = useAppStore((s) => s.setExcalidrawApi);
	const setElements = useAppStore((s) => s.setElements);
	const setAppState = useAppStore((s) => s.setAppState);
	const setFiles = useAppStore((s) => s.setFiles);
	const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
	const [imageFileData, setImageFileData] = useState<BinaryFileData | null>(null);

	const prevIsGuideModeRef = useRef(isGuideMode);
	const prevInitialSurfaceDataRef = useRef<string>('');
	const prevImageFileDataRef = useRef<BinaryFileData | null>(null);
	const prevCameraTargetRef = useRef<CameraTarget>(guideBaseline.camera);

	// Camera sub-hook: handles camera state and viewport calculations
	const {
		cameraRef,
		liveCamera,
		setLiveCamera,
		buildGuideAppState,
		buildExploreAppState,
		createCameraFromAppState,
	} = useTourCamera({
		initialCamera,
		viewportSize,
	});

	// Scene capture sub-hook: handles snapshot capture/restore
	const {
		exploreSessionRef,
		exploreSessionVersion,
		setExploreSessionSnapshot,
		getExploreSessionSnapshot,
		getCurrentSceneSnapshot,
		applySceneSnapshot,
		initialSurfaceData,
	} = useTourSceneCapture({
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
	});

	// Tool manager sub-hook: handles tool selection
	const { handleToolSelect } = useTourToolManager({
		excalidrawApiRef,
		isGuideMode,
		setActiveTool,
	});

	// Excalidraw API ready handler
	const handleExcalidrawApiReady = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			if (excalidrawApiRef.current === api) return;
			excalidrawApiRef.current = api;
			setExcalidrawApi(api);
			api.setActiveTool({ type: 'selection', locked: false });
		},
		[setExcalidrawApi],
	);

	// Excalidraw change handler: syncs store and updates session snapshot
	const handleExcalidrawChange = useCallback(
		(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
			setElements([...elements]);
			setAppState({ ...appState, collaborators: undefined });
			cameraRef.current = createCameraFromAppState(appState);
			setLiveCamera(cameraRef.current);
			if (!isGuideMode) {
				exploreSessionRef.current = {
					elements: normalizeSceneElements([...elements]),
					appState: cloneAppState({ ...appState, collaborators: undefined }),
					files: { ...files },
				};
			}
			const nextTool = getTourTool(appState.activeTool?.type);
			if (nextTool) setActiveTool(nextTool);
			setFiles(files);
		},
		[
			createCameraFromAppState,
			isGuideMode,
			setActiveTool,
			setAppState,
			setElements,
			setFiles,
			cameraRef,
			exploreSessionRef,
		],
	);

	// Mount effects
	useMountEffect(() => {
		let isDisposed = false;

		setElements(guideBaseline.elements);
		setAppState({
			viewBackgroundColor: '#f7f8fb',
			scrollX: 1440 / (2 * initialCamera.zoom) - initialCamera.x,
			scrollY: 900 / (2 * initialCamera.zoom) - initialCamera.y,
			zoom: { value: initialCamera.zoom as never },
		});
		cameraRef.current = initialCamera;
		setFiles(defaultScene.files);

		void fetch('/images/lecture_clip.png')
			.then((res) => res.blob())
			.then((blob) => {
				if (isDisposed) return;
				const reader = new FileReader();
				reader.onloadend = () => {
					if (isDisposed) return;
					const fileData = {
						id: imageId,
						mimeType: 'image/png' as const,
						dataURL: reader.result as BinaryFileData['dataURL'],
						created: Date.now(),
					};
					const currentFiles = useAppStore.getState().files;
					setFiles({ ...currentFiles, [imageId]: fileData });
					setImageFileData(fileData);
					excalidrawApiRef.current?.addFiles([fileData]);
				};
				reader.readAsDataURL(blob);
			})
			.catch((error) => {
				console.error('Failed to load tour scene image (/images/lecture_clip.png):', error);
				captureBrowserException(error instanceof Error ? error : new Error(String(error)), {
					tags: { component: 'useCanvasTourSceneController', operation: 'fetchTourImage' },
				});
			});

		return () => {
			isDisposed = true;
		};
	});

	useMountEffect(() => () => setExcalidrawApi(null));

	useMountEffect(() => {
		if (typeof ResizeObserver === 'undefined') return;

		const checkAndObserve = () => {
			const element = stageViewportRef.current;
			if (!element) {
				const timeoutId = setTimeout(checkAndObserve, 50);
				return () => clearTimeout(timeoutId);
			}
			resizeObserverRef.current = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (entry) {
					setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
				}
			});
			resizeObserverRef.current.observe(element);
		};

		const cleanupTimeout = checkAndObserve();
		return () => {
			if (cleanupTimeout) cleanupTimeout();
			resizeObserverRef.current?.disconnect();
		};
	});

	useMountEffect(() => {
		// Handle mode change
		if (prevIsGuideModeRef.current !== isGuideMode) {
			prevIsGuideModeRef.current = isGuideMode;
			if (excalidrawApiRef.current && isGuideMode && cameraRef.current) {
				const nextAppState = { ...buildGuideAppState(cameraRef.current) };
				updateSceneAndSyncAppStore(excalidrawApiRef.current, { appState: nextAppState });
			}
		}

		// Apply initial surface data when it changes
		const surfaceDataKey = JSON.stringify({
			elements: initialSurfaceData.elements.map((e) => e.id).join(','),
			isGuideMode,
			exploreSessionVersion,
		});
		if (prevInitialSurfaceDataRef.current !== surfaceDataKey) {
			prevInitialSurfaceDataRef.current = surfaceDataKey;
			const api = excalidrawApiRef.current;
			if (api) {
				updateSceneAndSyncAppStore(api, {
					elements: initialSurfaceData.elements,
					appState: initialSurfaceData.appState as never,
				});
			}
		}

		// Add image file data when available
		if (prevImageFileDataRef.current?.id !== imageFileData?.id) {
			prevImageFileDataRef.current = imageFileData;
			if (excalidrawApiRef.current && imageFileData) {
				excalidrawApiRef.current.addFiles([imageFileData]);
			}
		}

		// Animate camera when guide mode camera target changes
		const cameraKey = `${guideBaseline.camera.x},${guideBaseline.camera.y},${guideBaseline.camera.zoom}`;
		const prevCameraKey = `${prevCameraTargetRef.current.x},${prevCameraTargetRef.current.y},${prevCameraTargetRef.current.zoom}`;

		if (cameraKey !== prevCameraKey && isGuideMode) {
			prevCameraTargetRef.current = guideBaseline.camera;
			const api = excalidrawApiRef.current;
			if (!api) return;

			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current);
			}

			const startCamera = cameraRef.current;
			const targetCamera = guideBaseline.camera;
			const startTime = performance.now();
			const duration = 650;

			const tick = (now: number) => {
				const progress = Math.min(1, (now - startTime) / duration);
				const eased = 1 - (1 - progress) * (1 - progress);
				const nextCamera = {
					x: startCamera.x + (targetCamera.x - startCamera.x) * eased,
					y: startCamera.y + (targetCamera.y - startCamera.y) * eased,
					zoom: startCamera.zoom + (targetCamera.zoom - startCamera.zoom) * eased,
				};

				cameraRef.current = nextCamera;
				setLiveCamera(nextCamera);
				const nextAppState = {
					viewBackgroundColor: '#f7f8fb',
					...buildGuideAppState(nextCamera),
				};
				updateSceneAndSyncAppStore(api, {
					appState: nextAppState,
					collaborators: getCollaborators() as never,
				});

				if (progress < 1) {
					animationFrameRef.current = requestAnimationFrame(tick);
					return;
				}
				animationFrameRef.current = null;
			};

			animationFrameRef.current = requestAnimationFrame(tick);
		}
	});

	useMountEffect(() => {
		return () => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	});

	return {
		stageViewportRef,
		imageFileData,
		liveCamera,
		excalidrawMountKey: `${isGuideMode ? 'guide' : 'explore'}-${surfaceEpoch}`,
		initialSurfaceData,
		handleExcalidrawApiReady,
		handleExcalidrawChange,
		handleToolSelect,
		getCurrentSceneSnapshot,
		applySceneSnapshot,
		buildGuideAppState,
		buildExploreAppState,
		createCameraFromAppState,
		setExploreSessionSnapshot,
		getExploreSessionSnapshot,
	};
}
