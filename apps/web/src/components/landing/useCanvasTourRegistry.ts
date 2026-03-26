/**
 * Canvas Tour Registry Hook - Orchestrator
 *
 * Composes domain-specific hooks:
 * - useTourSceneRegistry: Scene definitions and lookups
 * - useTourNavigation: Chapter navigation
 * - useTourCapture: Scene capture/restore
 * - useTourChapterState: Chapter completion tracking
 *
 * Target: ~80 lines of orchestration only.
 */

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import { useCallback, useMemo, useState } from 'react';
import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import { canvasTourChapters } from './canvas-tour-content';
import type { RegisteredTourSceneSnapshot } from './canvas-tour-registry';
import type { RegisteredTourSceneLibrary } from './canvas-tour-registry';
import { TOUR_IMAGE_FILE_ID, createCanvasTourScene } from './canvas-tour-scene';
import type { CanvasTourRegistryActions, CanvasTourRegistryState } from './canvas-tour-types';
import { type CaptureMode, useTourCapture } from './hooks/useTourCapture';
import { buildDefaultSceneSnapshot, useTourSceneRegistry } from './hooks/useTourSceneRegistry';
import type {
	ApplySceneSnapshotOptions,
	CameraTarget,
	CanvasSceneSnapshot,
	TourTool,
} from './useCanvasTourSceneController';

export interface UseCanvasTourRegistryResult
	extends CanvasTourRegistryState,
		CanvasTourRegistryActions {
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

export function useCanvasTourRegistry({
	isGuideMode,
	setActiveTool,
}: UseCanvasTourRegistryArgs): UseCanvasTourRegistryResult {
	// Core refs
	const imageId = TOUR_IMAGE_FILE_ID;
	const activeChapter = canvasTourChapters[0];
	const defaultSceneId = activeChapter?.id ?? 'canvas-tour-default';
	const defaultOverlay = activeChapter.overlay;

	// Default scene elements
	const defaultScene = useMemo(() => ({ ...createCanvasTourScene(imageId), imageId }), [imageId]);

	// Domain hooks
	const sceneRegistry = useTourSceneRegistry();

	// Registry state (managed locally, not in sub-hook due to init load pattern)
	const [registrySceneId, setRegistrySceneId] = useState(defaultSceneId);
	const [registryCaptureMode, setRegistryCaptureMode] = useState<CaptureMode>('full');
	const [devCaptureStatus, setDevCaptureStatus] = useState<string | null>(null);

	// Capture hook (initializes with loaded storage)
	const capture = useTourCapture({
		sceneLibrary: null,
		defaultElements: defaultScene.elements,
		captureMode: registryCaptureMode,
	});

	// Initialize library from storage
	const [registeredSceneLibrary, setRegisteredSceneLibrary] = useState(() =>
		capture.loadFromStorage(),
	);

	// Guide state (derived from initial loaded scene)
	const initialScene = registeredSceneLibrary?.scenes[defaultSceneId];
	const [guideBaseline, setGuideBaseline] = useState({
		elements: (initialScene?.elements ?? defaultScene.elements) as ExcalidrawElement[],
		camera: initialScene?.camera ?? activeChapter.camera,
	});
	const [guideOverlay, setGuideOverlay] = useState(initialScene?.overlay ?? defaultOverlay);
	const [overlayDraft, setOverlayDraft] = useState(initialScene?.overlay ?? defaultOverlay);

	// Getters
	const getDefaultSceneForId = useCallback(
		(id: string) =>
			buildDefaultSceneSnapshot(id, defaultScene.elements) as RegisteredTourSceneSnapshot,
		[defaultScene.elements],
	);
	const getRegisteredSceneForId = useCallback(
		(id: string) => registeredSceneLibrary?.scenes[id] ?? null,
		[registeredSceneLibrary],
	);
	const resolveChapter = useCallback(
		(id: string) => sceneRegistry.getChapterById(id) ?? activeChapter,
		[sceneRegistry, activeChapter],
	);

	// Action: Register current layout
	const registerCurrentLayout = useCallback(
		(
			getSnapshot: () => CanvasSceneSnapshot,
			createCamera: (appState: Partial<unknown>) => CameraTarget,
			applySnapshot: (snapshot: CanvasSceneSnapshot, options?: ApplySceneSnapshotOptions) => void,
		) => {
			void applySnapshot;
			if (isGuideMode) return setDevCaptureStatus('Switch to Explore Demo before registering.');

			const snapshot = getSnapshot();
			const camera = createCamera(snapshot.appState);
			const prev =
				getRegisteredSceneForId(registrySceneId) ?? getDefaultSceneForId(registrySceneId);
			const mode = registryCaptureMode;

			const nextScene: RegisteredTourSceneSnapshot = {
				sceneId: registrySceneId,
				elements: mode === 'camera' ? prev.elements : (snapshot.elements as ExcalidrawElement[]),
				camera: mode === 'elements' ? prev.camera : camera,
				overlay: prev.overlay,
				capturedAt: new Date().toISOString(),
			};

			const nextLibrary = {
				scenes: { ...registeredSceneLibrary?.scenes, [registrySceneId]: nextScene },
				updatedAt: nextScene.capturedAt,
			};
			setRegisteredSceneLibrary(nextLibrary);
			capture.persistCapture(nextScene);

			if (registrySceneId === activeChapter.id) {
				setGuideBaseline({ elements: nextScene.elements, camera: nextScene.camera });
				setGuideOverlay(nextScene.overlay);
			}
			setDevCaptureStatus(
				`Registered ${mode} for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
			);
		},
		[
			isGuideMode,
			registrySceneId,
			registryCaptureMode,
			registeredSceneLibrary,
			activeChapter.id,
			getDefaultSceneForId,
			getRegisteredSceneForId,
			resolveChapter,
			capture,
		],
	);

	// Action: Restore layout
	const restoreRegisteredLayout = useCallback(
		(
			imageFileData: BinaryFileData | null,
			buildGuide: (camera: CameraTarget) => Partial<unknown>,
			buildExplore: (camera: CameraTarget) => Partial<unknown>,
			applySnapshot: (snapshot: CanvasSceneSnapshot, options?: ApplySceneSnapshotOptions) => void,
			setExploreSession: (snapshot: CanvasSceneSnapshot | null) => void,
		) => {
			const registered = getRegisteredSceneForId(registrySceneId);
			if (!registered)
				return setDevCaptureStatus(
					`No registered layout for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
				);

			if (registrySceneId === activeChapter.id) {
				setGuideBaseline({ elements: registered.elements, camera: registered.camera });
				setGuideOverlay(registered.overlay);
			}
			setOverlayDraft(registered.overlay);

			const files = imageFileData ? { [imageFileData.id]: imageFileData } : {};
			const snapshot = {
				elements: registered.elements,
				appState: isGuideMode ? buildGuide(registered.camera) : buildExplore(registered.camera),
				files,
			};

			if (isGuideMode) {
				applySnapshot(
					{ ...snapshot, appState: buildGuide(registered.camera) },
					{ preserveSelection: false, cameraOverride: registered.camera },
				);
				setActiveTool('selection');
			} else {
				setExploreSession(snapshot);
				applySnapshot(snapshot, { preserveSelection: true });
			}
			setDevCaptureStatus(`Loaded ${resolveChapter(registrySceneId).label.toLowerCase()}.`);
		},
		[
			isGuideMode,
			registrySceneId,
			activeChapter.id,
			getRegisteredSceneForId,
			resolveChapter,
			setActiveTool,
		],
	);

	// Action: Clear layout
	const clearRegisteredLayout = useCallback(
		(
			imageFileData: BinaryFileData | null,
			buildGuide: (camera: CameraTarget) => Partial<unknown>,
			applySnapshot: (snapshot: CanvasSceneSnapshot, options?: ApplySceneSnapshotOptions) => void,
		) => {
			const scenes = { ...registeredSceneLibrary?.scenes };
			delete scenes[registrySceneId];
			const nextLibrary =
				Object.keys(scenes).length > 0 ? { scenes, updatedAt: new Date().toISOString() } : null;
			setRegisteredSceneLibrary(nextLibrary);
			if (!nextLibrary) capture.clearAllScenes();

			if (registrySceneId === activeChapter.id) {
				setGuideBaseline({ elements: defaultScene.elements, camera: activeChapter.camera });
				setGuideOverlay(activeChapter.overlay);
			}
			setOverlayDraft(resolveChapter(registrySceneId).overlay);

			if (isGuideMode && registrySceneId === activeChapter.id) {
				applySnapshot(
					{
						elements: defaultScene.elements,
						appState: buildGuide(activeChapter.camera),
						files: imageFileData ? { [imageFileData.id]: imageFileData } : {},
					},
					{ preserveSelection: false, cameraOverride: activeChapter.camera },
				);
				setActiveTool('selection');
			}
			setDevCaptureStatus(`Cleared ${resolveChapter(registrySceneId).label.toLowerCase()}.`);
		},
		[
			isGuideMode,
			registrySceneId,
			activeChapter,
			defaultScene.elements,
			registeredSceneLibrary,
			resolveChapter,
			capture,
			setActiveTool,
		],
	);

	// Overlay actions
	const saveOverlayDraft = useCallback(() => {
		const prev =
			getRegisteredSceneForId(registrySceneId) ??
			(getDefaultSceneForId(registrySceneId) as RegisteredTourSceneSnapshot);
		const nextScene: RegisteredTourSceneSnapshot = {
			...prev,
			overlay: overlayDraft,
			capturedAt: new Date().toISOString(),
		};
		const nextLibrary: RegisteredTourSceneLibrary = {
			scenes: { ...registeredSceneLibrary?.scenes, [registrySceneId]: nextScene },
			updatedAt: nextScene.capturedAt,
		};
		setRegisteredSceneLibrary(nextLibrary);
		capture.persistCapture(nextScene);
		if (registrySceneId === activeChapter.id) setGuideOverlay(overlayDraft);
		setDevCaptureStatus(
			`Saved overlay for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
		);
	}, [
		overlayDraft,
		registrySceneId,
		activeChapter.id,
		registeredSceneLibrary,
		getDefaultSceneForId,
		getRegisteredSceneForId,
		resolveChapter,
		capture,
	]);

	const applyOverlayDraft = useCallback(() => {
		if (registrySceneId === activeChapter.id) {
			setGuideOverlay(overlayDraft);
			setDevCaptureStatus('Overlay live on active scene.');
		} else {
			setDevCaptureStatus('Overlay updated. Save to register.');
		}
	}, [overlayDraft, registrySceneId, activeChapter.id]);

	const copyRegisteredLayout = useCallback(async () => {
		if (typeof window === 'undefined') return;
		const registered = getRegisteredSceneForId(registrySceneId);
		if (!registered)
			return setDevCaptureStatus(
				`No layout to copy for ${resolveChapter(registrySceneId).label.toLowerCase()}.`,
			);
		try {
			await navigator.clipboard.writeText(JSON.stringify(registered, null, 2));
			setDevCaptureStatus('Copied layout JSON.');
		} catch {
			setDevCaptureStatus('Copy failed.');
		}
	}, [registrySceneId, getRegisteredSceneForId, resolveChapter]);

	return useMemo(
		() => ({
			activeChapter,
			defaultScene,
			registeredSceneLibrary,
			registrySceneId,
			registryCaptureMode,
			guideBaseline,
			guideOverlay,
			overlayDraft,
			devCaptureStatus,
			getDefaultSceneForId,
			getRegisteredSceneForId,
			resolveChapter,
			setGuideBaseline,
			setGuideOverlay,
			setOverlayDraft,
			registerCurrentLayout,
			restoreRegisteredLayout,
			clearRegisteredLayout,
			saveOverlayDraft,
			applyOverlayDraft,
			copyRegisteredLayout,
			setRegistrySceneId,
			setRegistryCaptureMode,
		}),
		[
			activeChapter,
			defaultScene,
			registeredSceneLibrary,
			registrySceneId,
			registryCaptureMode,
			guideBaseline,
			guideOverlay,
			overlayDraft,
			devCaptureStatus,
			getDefaultSceneForId,
			getRegisteredSceneForId,
			resolveChapter,
			registerCurrentLayout,
			restoreRegisteredLayout,
			clearRegisteredLayout,
			saveOverlayDraft,
			applyOverlayDraft,
			copyRegisteredLayout,
		],
	);
}
