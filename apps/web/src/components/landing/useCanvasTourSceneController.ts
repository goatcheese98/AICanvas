import {
	cloneExcalidrawAppState,
	syncAppStoreFromExcalidraw,
	updateSceneAndSyncAppStore,
} from '@/components/canvas/excalidraw-store-sync';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	AppState,
	BinaryFileData,
	BinaryFiles,
	Collaborator,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { useCallback, useMemo, useRef, useState } from 'react';

export interface CameraTarget {
	x: number;
	y: number;
	zoom: number;
}

export interface CanvasSceneSnapshot {
	elements: ExcalidrawElement[];
	appState: Partial<AppState>;
	files: BinaryFiles;
}

export interface CanvasTourDefaultScene {
	elements: ExcalidrawElement[];
	files: BinaryFiles;
}

export type TourTool =
	| 'hand'
	| 'selection'
	| 'rectangle'
	| 'diamond'
	| 'ellipse'
	| 'arrow'
	| 'line'
	| 'freedraw'
	| 'text'
	| 'image'
	| 'eraser';

interface UseCanvasTourSceneControllerArgs {
	imageId: BinaryFileData['id'];
	defaultScene: CanvasTourDefaultScene;
	guideBaseline: {
		elements: ExcalidrawElement[];
		camera: CameraTarget;
	};
	initialCamera: CameraTarget;
	isGuideMode: boolean;
	surfaceEpoch: number;
	setActiveTool: (tool: TourTool) => void;
}

export interface ApplySceneSnapshotOptions {
	preserveSelection?: boolean;
	cameraOverride?: CameraTarget;
}

function cloneAppState(appState: Partial<AppState>): Partial<AppState> {
	return cloneExcalidrawAppState(appState);
}

function getCollaborators(): Map<string, Collaborator> {
	return new Map();
}

function getViewportAppState(target: CameraTarget, width: number, height: number) {
	const zoom = target.zoom;

	return {
		scrollX: width / (2 * zoom) - target.x,
		scrollY: height / (2 * zoom) - target.y,
		zoom: { value: zoom as never },
	};
}

export function getTourTool(value: unknown): TourTool | null {
	return value === 'hand' ||
		value === 'selection' ||
		value === 'rectangle' ||
		value === 'diamond' ||
		value === 'ellipse' ||
		value === 'arrow' ||
		value === 'line' ||
		value === 'freedraw' ||
		value === 'text' ||
		value === 'image' ||
		value === 'eraser'
		? value
		: null;
}

export function useCanvasTourSceneController({
	imageId,
	defaultScene,
	guideBaseline,
	initialCamera,
	isGuideMode,
	surfaceEpoch,
	setActiveTool,
}: UseCanvasTourSceneControllerArgs) {
	const setExcalidrawApi = useAppStore((s) => s.setExcalidrawApi);
	const setElements = useAppStore((s) => s.setElements);
	const setAppState = useAppStore((s) => s.setAppState);
	const setFiles = useAppStore((s) => s.setFiles);
	const stageViewportRef = useRef<HTMLDivElement | null>(null);
	const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const cameraRef = useRef<CameraTarget>(initialCamera);
	const exploreSessionRef = useRef<CanvasSceneSnapshot | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
	const [imageFileData, setImageFileData] = useState<BinaryFileData | null>(null);
	const [liveCamera, setLiveCamera] = useState<CameraTarget>(initialCamera);
	const [exploreSessionVersion, setExploreSessionVersion] = useState(0);

	// Track previous values to trigger updates in useMountEffect
	const prevIsGuideModeRef = useRef(isGuideMode);
	const prevInitialSurfaceDataRef = useRef<string>('');
	const prevImageFileDataRef = useRef<BinaryFileData | null>(null);
	const prevCameraTargetRef = useRef<CameraTarget>(guideBaseline.camera);

	const buildGuideAppState = useCallback(
		(targetCamera: CameraTarget): Partial<AppState> => ({
			viewBackgroundColor: '#f7f8fb',
			viewModeEnabled: true,
			selectedElementIds: {},
			openMenu: null,
			openPopup: null,
			openSidebar: null,
			openDialog: null,
			contextMenu: null,
			editingTextElement: null,
			editingLinearElement: null,
			activeEmbeddable: null,
			...getViewportAppState(targetCamera, viewportSize.width, viewportSize.height),
		}),
		[viewportSize.height, viewportSize.width],
	);

	const createCameraFromAppState = useCallback(
		(appState: Partial<AppState>): CameraTarget => {
			const zoom =
				typeof appState.zoom?.value === 'number' && appState.zoom.value > 0
					? appState.zoom.value
					: 1;
			const width =
				typeof appState.width === 'number' && appState.width > 0
					? appState.width
					: viewportSize.width;
			const height =
				typeof appState.height === 'number' && appState.height > 0
					? appState.height
					: viewportSize.height;
			const scrollX = typeof appState.scrollX === 'number' ? appState.scrollX : 0;
			const scrollY = typeof appState.scrollY === 'number' ? appState.scrollY : 0;

			return {
				x: width / (2 * zoom) - scrollX,
				y: height / (2 * zoom) - scrollY,
				zoom,
			};
		},
		[viewportSize.height, viewportSize.width],
	);

	const buildExploreAppState = useCallback(
		(targetCamera: CameraTarget): Partial<AppState> => ({
			viewBackgroundColor: '#f7f8fb',
			viewModeEnabled: false,
			...getViewportAppState(targetCamera, viewportSize.width, viewportSize.height),
		}),
		[viewportSize.height, viewportSize.width],
	);

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
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: setAppState, setElements, setFiles are stable zustand store selectors
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
			createCameraFromAppState,
			imageFileData,
			setAppState,
			setElements,
			setFiles,
			viewportSize.height,
			viewportSize.width,
		],
	);

	// Derived initial surface data - computed inline from dependencies
	// biome-ignore lint/correctness/useExhaustiveDependencies: exploreSessionVersion is used as a trigger for recomputation
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
		exploreSessionVersion,
		guideBaseline.camera,
		guideBaseline.elements,
		isGuideMode,
	]);

	const handleExcalidrawApiReady = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			if (excalidrawApiRef.current === api) {
				return;
			}

			excalidrawApiRef.current = api;
			setExcalidrawApi(api);
			api.setActiveTool({ type: 'selection', locked: false });
		},
		[setExcalidrawApi],
	);

	const handleExcalidrawChange = useCallback(
		(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
			setElements([...elements]);
			setAppState({
				...appState,
				collaborators: undefined,
			});
			cameraRef.current = createCameraFromAppState(appState);
			setLiveCamera(cameraRef.current);
			if (!isGuideMode) {
				exploreSessionRef.current = {
					elements: normalizeSceneElements([...elements]),
					appState: cloneAppState({
						...appState,
						collaborators: undefined,
					}),
					files: { ...files },
				};
			}
			const nextTool = getTourTool(appState.activeTool?.type);
			if (nextTool) {
				setActiveTool(nextTool);
			}
			setFiles(files);
		},
		[createCameraFromAppState, isGuideMode, setActiveTool, setAppState, setElements, setFiles],
	);

	// MOUNT EFFECTS - The only allowed useEffect pattern

	// Effect 1: Initialize scene and load image on mount (runs once)
	useMountEffect(() => {
		let isDisposed = false;

		setElements(guideBaseline.elements);
		setAppState({
			viewBackgroundColor: '#f7f8fb',
			...getViewportAppState(initialCamera, 1440, 900),
		});
		cameraRef.current = initialCamera;
		setFiles(defaultScene.files);

		void fetch('/images/lecture_clip.png')
			.then((res) => res.blob())
			.then((blob) => {
				if (isDisposed) {
					return;
				}
				const reader = new FileReader();
				reader.onloadend = () => {
					if (isDisposed) {
						return;
					}
					const fileData = {
						id: imageId,
						mimeType: 'image/png' as const,
						dataURL: reader.result as BinaryFileData['dataURL'],
						created: Date.now(),
					};
					const currentFiles = useAppStore.getState().files;
					setFiles({ ...currentFiles, [imageId]: fileData });
					setImageFileData(fileData);
					if (excalidrawApiRef.current) {
						excalidrawApiRef.current.addFiles([fileData]);
					}
				};
				reader.readAsDataURL(blob);
			})
			.catch(() => {});

		return () => {
			isDisposed = true;
		};
	});

	// Effect 2: Cleanup Excalidraw API on unmount (runs once)
	useMountEffect(() => {
		return () => {
			setExcalidrawApi(null as never);
		};
	});

	// Effect 3: Setup ResizeObserver for viewport size (runs once, manages its own state)
	useMountEffect(() => {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		const checkAndObserve = () => {
			const element = stageViewportRef.current;
			if (!element) {
				// Try again later if ref not set yet
				const timeoutId = setTimeout(checkAndObserve, 50);
				return () => clearTimeout(timeoutId);
			}

			resizeObserverRef.current = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (entry) {
					setViewportSize({
						width: entry.contentRect.width,
						height: entry.contentRect.height,
					});
				}
			});

			resizeObserverRef.current.observe(element);
		};

		const cleanupTimeout = checkAndObserve();

		return () => {
			if (cleanupTimeout) cleanupTimeout();
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
			}
		};
	});

	// Effect 4: Reactive updates that depend on prop changes
	// This effect runs on every render but only performs work when values actually change
	useMountEffect(() => {
		// Update camera when isGuideMode changes
		if (prevIsGuideModeRef.current !== isGuideMode) {
			prevIsGuideModeRef.current = isGuideMode;

			if (excalidrawApiRef.current && isGuideMode && cameraRef.current) {
				const nextAppState = {
					...getViewportAppState(cameraRef.current, viewportSize.width, viewportSize.height),
				};
				updateSceneAndSyncAppStore(excalidrawApiRef.current, { appState: nextAppState });
			}
		}

		// Apply initial surface data when it changes (using JSON stringify for comparison)
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

			const api = excalidrawApiRef.current;
			if (api && imageFileData) {
				api.addFiles([imageFileData]);
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
					...getViewportAppState(nextCamera, viewportSize.width, viewportSize.height),
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

	// Cleanup animation on unmount
	useMountEffect(() => {
		return () => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	});

	const setExploreSessionSnapshot = useCallback((snapshot: CanvasSceneSnapshot | null) => {
		exploreSessionRef.current = snapshot;
		setExploreSessionVersion((current) => current + 1);
	}, []);

	const getExploreSessionSnapshot = useCallback(() => exploreSessionRef.current, []);

	const handleToolSelect = useCallback(
		(tool: TourTool) => {
			if (isGuideMode) return;
			const api = excalidrawApiRef.current;
			if (!api) return;
			api.setActiveTool(
				tool === 'image'
					? { type: 'image', insertOnCanvasDirectly: true, locked: false }
					: { type: tool, locked: false },
			);
			setActiveTool(tool);
		},
		[isGuideMode, setActiveTool],
	);

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
