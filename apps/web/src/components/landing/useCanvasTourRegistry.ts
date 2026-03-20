/**
 * Registry hook for canvas tour page.
 *
 * Container/Hook/Child Pattern:
 * - Manages registered scene library persistence
 * - Handles CRUD operations for scene registration
 * - Manages overlay draft state
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import { canvasTourChapters } from './canvas-tour-content';
import type {
	RegisteredTourSceneLibrary,
	RegisteredTourSceneSnapshot,
} from './canvas-tour-registry';
import {
	clearRegisteredTourScenes,
	loadRegisteredTourScenes,
	persistRegisteredTourScenes,
} from './canvas-tour-registry';
import { TOUR_IMAGE_FILE_ID, createCanvasTourScene } from './canvas-tour-scene';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	ApplySceneSnapshotOptions,
	CameraTarget,
	CanvasSceneSnapshot,
	TourTool,
} from './useCanvasTourSceneController';
import type { CanvasTourRegistryState, CanvasTourRegistryActions } from './canvas-tour-types';

export interface UseCanvasTourRegistryResult extends CanvasTourRegistryState, CanvasTourRegistryActions {
	activeChapter: CanvasTourChapter;
	defaultScene: { elements: unknown[]; imageId: BinaryFileData['id'] };
	getDefaultSceneForId: (sceneId: string) => RegisteredTourSceneSnapshot;
	getRegisteredSceneForId: (sceneId: string) => RegisteredTourSceneSnapshot | null;
	resolveChapter: (sceneId: string) => CanvasTourChapter;
	setGuideBaseline: React.Dispatch<
		React.SetStateAction<{ elements: ExcalidrawElement[]; camera: CameraTarget }>
	>;
	setGuideOverlay: React.Dispatch<React.SetStateAction<CanvasTourGuideOverlay>>;
	setOverlayDraft: React.Dispatch<React.SetStateAction<CanvasTourGuideOverlay>>;
}

interface UseCanvasTourRegistryArgs {
	isGuideMode: boolean;
	setActiveTool: (tool: TourTool) => void;
}

function getChapterById(sceneId: string, fallback: CanvasTourChapter): CanvasTourChapter {
	return canvasTourChapters.find((chapter) => chapter.id === sceneId) ?? fallback;
}

export function useCanvasTourRegistry({
	isGuideMode,
	setActiveTool,
}: UseCanvasTourRegistryArgs): UseCanvasTourRegistryResult {
	const imageId = TOUR_IMAGE_FILE_ID;
	const activeChapter = canvasTourChapters[0];
	const defaultSceneId = activeChapter?.id ?? 'canvas-tour-default';
	const defaultOverlay = activeChapter.overlay;

	const defaultScene = useMemo(() => {
		const result = createCanvasTourScene(imageId);
		return { ...result, imageId };
	}, [imageId]);

	const [registeredSceneLibrary, setRegisteredSceneLibrary] =
		useState<RegisteredTourSceneLibrary | null>(() => loadRegisteredTourScenes());

	const initialRegisteredScene = registeredSceneLibrary?.scenes[defaultSceneId] ?? null;

	const [guideBaseline, setGuideBaseline] = useState<{ elements: ExcalidrawElement[]; camera: CameraTarget }>(() => ({
		elements: (initialRegisteredScene?.elements ?? defaultScene.elements) as ExcalidrawElement[],
		camera: initialRegisteredScene?.camera ?? activeChapter.camera,
	}));

	const [guideOverlay, setGuideOverlay] = useState<CanvasTourGuideOverlay>(
		initialRegisteredScene?.overlay ?? defaultOverlay,
	);

	const [devCaptureStatus, setDevCaptureStatus] = useState<string | null>(null);
	const [registrySceneId, setRegistrySceneId] = useState(defaultSceneId);
	const [registryCaptureMode, setRegistryCaptureMode] = useState<'full' | 'camera' | 'elements'>(
		'full',
	);
	const [overlayDraft, setOverlayDraft] = useState<CanvasTourGuideOverlay>(
		initialRegisteredScene?.overlay ?? defaultOverlay,
	);

	const resolveChapter = useCallback(
		(sceneId: string) => getChapterById(sceneId, activeChapter),
		[activeChapter],
	);

	const getDefaultSceneForId = useCallback(
		(sceneId: string): RegisteredTourSceneSnapshot => {
			const chapter = resolveChapter(sceneId);
			return {
				sceneId,
				elements: defaultScene.elements,
				camera: chapter.camera,
				overlay: chapter.overlay,
				capturedAt: new Date(0).toISOString(),
			};
		},
		[defaultScene.elements, resolveChapter],
	);

	const getRegisteredSceneForId = useCallback(
		(sceneId: string) => registeredSceneLibrary?.scenes[sceneId] ?? null,
		[registeredSceneLibrary],
	);

	// Derived state pattern: compute next overlay from registrySceneId
	const nextOverlayFromRegistry = useMemo(
		() =>
			getRegisteredSceneForId(registrySceneId)?.overlay ?? resolveChapter(registrySceneId).overlay,
		[getRegisteredSceneForId, registrySceneId, resolveChapter],
	);

	// Sync overlayDraft when registry scene changes using ref comparison
	const prevOverlayRef = useRef(nextOverlayFromRegistry);
	if (nextOverlayFromRegistry !== prevOverlayRef.current) {
		prevOverlayRef.current = nextOverlayFromRegistry;
		setOverlayDraft(nextOverlayFromRegistry);
	}

	const registerCurrentLayout = useCallback(
		(
			getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
			createCameraFromAppState: (appState: Partial<unknown>) => CameraTarget,
			applySceneSnapshot: (
				snapshot: CanvasSceneSnapshot,
				options?: ApplySceneSnapshotOptions,
			) => void,
		) => {
			if (isGuideMode) {
				setDevCaptureStatus('Switch to Explore Demo before registering a layout.');
				return;
			}
			const snapshot = getCurrentSceneSnapshot();
			const camera = createCameraFromAppState(snapshot.appState);
			const previousScene =
				getRegisteredSceneForId(registrySceneId) ?? getDefaultSceneForId(registrySceneId);
			const nextScene: RegisteredTourSceneSnapshot = {
				sceneId: registrySceneId,
				elements: registryCaptureMode === 'camera' ? previousScene.elements : snapshot.elements,
				camera: registryCaptureMode === 'elements' ? previousScene.camera : camera,
				overlay: previousScene.overlay,
				capturedAt: new Date().toISOString(),
			};
			const nextLibrary: RegisteredTourSceneLibrary = {
				scenes: {
					...(registeredSceneLibrary?.scenes ?? {}),
					[registrySceneId]: nextScene,
				},
				updatedAt: nextScene.capturedAt,
			};
			persistRegisteredTourScenes(nextLibrary);
			setRegisteredSceneLibrary(nextLibrary);
			if (registrySceneId === activeChapter.id) {
				setGuideBaseline({
					elements: nextScene.elements,
					camera: nextScene.camera,
				});
				setGuideOverlay(nextScene.overlay);
			}
			const scopeLabel =
				registryCaptureMode === 'full'
					? 'scene + camera'
					: registryCaptureMode === 'camera'
						? 'camera'
						: 'elements';
			setDevCaptureStatus(
				`Registered ${scopeLabel} for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
			);
			void applySceneSnapshot;
		},
		[
			activeChapter.id,
			getDefaultSceneForId,
			getRegisteredSceneForId,
			isGuideMode,
			registeredSceneLibrary?.scenes,
			registryCaptureMode,
			registrySceneId,
			resolveChapter,
		],
	);

	const restoreRegisteredLayout = useCallback(
		(
			imageFileData: BinaryFileData | null,
			buildGuideAppState: (camera: CameraTarget) => Partial<unknown>,
			buildExploreAppState: (camera: CameraTarget) => Partial<unknown>,
			applySceneSnapshot: (
				snapshot: CanvasSceneSnapshot,
				options?: ApplySceneSnapshotOptions,
			) => void,
			setExploreSessionSnapshot: (snapshot: CanvasSceneSnapshot | null) => void,
		) => {
			const registered = getRegisteredSceneForId(registrySceneId);
			if (!registered) {
				setDevCaptureStatus(
					`No registered layout found for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
				);
				return;
			}
			if (registrySceneId === activeChapter.id) {
				setGuideBaseline({
					elements: registered.elements,
					camera: registered.camera,
				});
				setGuideOverlay(registered.overlay);
			}
			setOverlayDraft(registered.overlay);
			const registeredFiles = imageFileData ? { [imageFileData.id]: imageFileData } : {};
			const registeredSnapshot: CanvasSceneSnapshot = {
				elements: registered.elements,
				appState: buildExploreAppState(registered.camera),
				files: registeredFiles,
			};
			if (isGuideMode) {
				applySceneSnapshot(
					{
						elements: registered.elements,
						appState: buildGuideAppState(registered.camera),
						files: registeredFiles,
					},
					{ preserveSelection: false, cameraOverride: registered.camera },
				);
				setActiveTool('selection');
			} else {
				setExploreSessionSnapshot(registeredSnapshot);
				applySceneSnapshot(registeredSnapshot, { preserveSelection: true });
			}
			setDevCaptureStatus(`Loaded ${resolveChapter(registrySceneId).label.toLowerCase()} layout.`);
		},
		[activeChapter.id, getRegisteredSceneForId, isGuideMode, registrySceneId, resolveChapter, setActiveTool],
	);

	const clearRegisteredLayout = useCallback(
		(
			imageFileData: BinaryFileData | null,
			buildGuideAppState: (camera: CameraTarget) => Partial<unknown>,
			applySceneSnapshot: (
				snapshot: CanvasSceneSnapshot,
				options?: ApplySceneSnapshotOptions,
			) => void,
		) => {
			const nextScenes = { ...(registeredSceneLibrary?.scenes ?? {}) };
			delete nextScenes[registrySceneId];
			const hasScenes = Object.keys(nextScenes).length > 0;
			const nextLibrary = hasScenes
				? {
						scenes: nextScenes,
						updatedAt: new Date().toISOString(),
					}
				: null;
			if (nextLibrary) {
				persistRegisteredTourScenes(nextLibrary);
			} else {
				clearRegisteredTourScenes();
			}
			setRegisteredSceneLibrary(nextLibrary);
			if (registrySceneId === activeChapter.id) {
				setGuideBaseline({
					elements: defaultScene.elements,
					camera: activeChapter.camera,
				});
				setGuideOverlay(activeChapter.overlay);
			}
			setOverlayDraft(resolveChapter(registrySceneId).overlay);
			if (isGuideMode && registrySceneId === activeChapter.id) {
				applySceneSnapshot(
					{
						elements: defaultScene.elements,
						appState: buildGuideAppState(activeChapter.camera),
						files: imageFileData ? { [imageFileData.id]: imageFileData } : {},
					},
					{ preserveSelection: false, cameraOverride: activeChapter.camera },
				);
				setActiveTool('selection');
			}
			setDevCaptureStatus(`Cleared ${resolveChapter(registrySceneId).label.toLowerCase()} layout.`);
		},
		[
			activeChapter.camera,
			activeChapter.id,
			activeChapter.overlay,
			defaultScene.elements,
			isGuideMode,
			registeredSceneLibrary?.scenes,
			registrySceneId,
			resolveChapter,
			setActiveTool,
		],
	);

	const saveOverlayDraft = useCallback(() => {
		const previousScene =
			getRegisteredSceneForId(registrySceneId) ?? getDefaultSceneForId(registrySceneId);
		const nextScene: RegisteredTourSceneSnapshot = {
			...previousScene,
			overlay: overlayDraft,
			capturedAt: new Date().toISOString(),
		};
		const nextLibrary: RegisteredTourSceneLibrary = {
			scenes: {
				...(registeredSceneLibrary?.scenes ?? {}),
				[registrySceneId]: nextScene,
			},
			updatedAt: nextScene.capturedAt,
		};
		persistRegisteredTourScenes(nextLibrary);
		setRegisteredSceneLibrary(nextLibrary);
		if (registrySceneId === activeChapter.id) {
			setGuideOverlay(overlayDraft);
		}
		setDevCaptureStatus(
			`Saved overlay editor changes for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
		);
	}, [
		activeChapter.id,
		getDefaultSceneForId,
		getRegisteredSceneForId,
		overlayDraft,
		registeredSceneLibrary?.scenes,
		registrySceneId,
		resolveChapter,
	]);

	const applyOverlayDraft = useCallback(() => {
		if (registrySceneId === activeChapter.id) {
			setGuideOverlay(overlayDraft);
			setDevCaptureStatus('Overlay draft is now live on the active scene.');
			return;
		}
		setDevCaptureStatus('Overlay draft updated. Save it to register this scene.');
	}, [activeChapter.id, overlayDraft, registrySceneId]);

	const copyRegisteredLayout = useCallback(async () => {
		if (typeof window === 'undefined') return;
		const registered = getRegisteredSceneForId(registrySceneId);
		if (!registered) {
			setDevCaptureStatus(
				`No registered layout to copy for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
			);
			return;
		}
		try {
			await window.navigator.clipboard.writeText(JSON.stringify(registered, null, 2));
			setDevCaptureStatus('Copied registered layout JSON.');
		} catch {
			setDevCaptureStatus('Could not copy layout JSON.');
		}
	}, [getRegisteredSceneForId, registrySceneId, resolveChapter]);

	return {
		// Core data
		activeChapter,
		defaultScene,
		// State
		registeredSceneLibrary,
		registrySceneId,
		registryCaptureMode,
		guideBaseline,
		guideOverlay,
		overlayDraft,
		devCaptureStatus,
		// Getters
		getDefaultSceneForId,
		getRegisteredSceneForId,
		resolveChapter,
		// Setters (needed by orchestrator)
		setGuideBaseline,
		setGuideOverlay,
		setOverlayDraft,
		// Actions
		registerCurrentLayout,
		restoreRegisteredLayout,
		clearRegisteredLayout,
		saveOverlayDraft,
		applyOverlayDraft,
		copyRegisteredLayout,
		setRegistrySceneId,
		setRegistryCaptureMode,
	};
}
