import { useMountEffect } from '@/hooks/useMountEffect';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import { canvasTourChapters } from './canvas-tour-content';
import {
	OVERLAY_DEFAULT_HEIGHT_REM,
	type OverlayPlacementBounds,
	type OverlayPlacementPreset,
	type OverlaySafeArea,
	buildOverlayPlacementBounds,
	buildSafeArea,
	calculateOverlayPreset,
	clamp,
	clampOverlayPlacement,
	getRootFontSizePx,
} from './canvas-tour-page-utils';
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
import type {
	ApplySceneSnapshotOptions,
	CameraTarget,
	CanvasSceneSnapshot,
	TourTool,
} from './useCanvasTourSceneController';

const IS_DEV = import.meta.env.DEV;

export interface CanvasTourPageState {
	// Core refs and data
	imageId: BinaryFileData['id'];
	activeChapter: CanvasTourChapter;
	defaultScene: { elements: unknown[]; imageId: BinaryFileData['id'] };
	stageViewportRef: React.RefObject<HTMLDivElement | null>;
	overlayShellRef: React.RefObject<HTMLDivElement | null>;
	layoutPanelRef: React.RefObject<HTMLDivElement | null>;

	// Mode state
	isGuideMode: boolean;
	isGridVisible: boolean;
	activeTool: TourTool;
	surfaceEpoch: number;
	isRegistryOpen: boolean;

	// Scene state
	registeredSceneLibrary: RegisteredTourSceneLibrary | null;
	registrySceneId: string;
	registryCaptureMode: 'full' | 'camera' | 'elements';
	guideBaseline: { elements: unknown[]; camera: CameraTarget };
	guideOverlay: CanvasTourGuideOverlay;
	overlayDraft: CanvasTourGuideOverlay;

	// Dev status
	devCaptureStatus: string | null;

	// Overlay placement
	stageViewportSize: { widthPx: number; heightPx: number };
	overlayShellHeightPx: number;
	rootFontSizePx: number;
	guideSafeArea: OverlaySafeArea;
	editorSafeArea: OverlaySafeArea;
	overlayPlacementBounds: OverlayPlacementBounds;
	guidePlacement: CanvasTourGuideOverlay['placement'];
	previewPlacement: CanvasTourGuideOverlay['placement'];
	displayedPlacement: CanvasTourGuideOverlay['placement'];
	visibleOverlay: CanvasTourGuideOverlay;
	introOverlayStyle: React.CSSProperties;

	// Computed flags
	showRegistryControls: boolean;
	selectedRegistryChapter: CanvasTourChapter;
	selectedRegisteredScene: RegisteredTourSceneSnapshot | null;

	// Actions
	resetDemo: () => void;
	enterGuideMode: (getCurrentSceneSnapshot: () => CanvasSceneSnapshot) => void;
	enterExploreMode: (
		getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
		getExploreSessionSnapshot: () => CanvasSceneSnapshot | null,
	) => void;
	setIsGridVisible: React.Dispatch<React.SetStateAction<boolean>>;
	setActiveTool: React.Dispatch<React.SetStateAction<TourTool>>;
	setIsRegistryOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setStageViewportSize: React.Dispatch<React.SetStateAction<{ widthPx: number; heightPx: number }>>;

	// Registry actions
	registerCurrentLayout: (
		getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
		createCameraFromAppState: (appState: Partial<unknown>) => CameraTarget,
		applySceneSnapshot: (
			snapshot: CanvasSceneSnapshot,
			options?: ApplySceneSnapshotOptions,
		) => void,
	) => void;
	restoreRegisteredLayout: (
		imageFileData: BinaryFileData | null,
		buildGuideAppState: (camera: CameraTarget) => Partial<unknown>,
		buildExploreAppState: (camera: CameraTarget) => Partial<unknown>,
		applySceneSnapshot: (
			snapshot: CanvasSceneSnapshot,
			options?: ApplySceneSnapshotOptions,
		) => void,
		setExploreSessionSnapshot: (snapshot: CanvasSceneSnapshot | null) => void,
	) => void;
	clearRegisteredLayout: (
		imageFileData: BinaryFileData | null,
		buildGuideAppState: (camera: CameraTarget) => Partial<unknown>,
		applySceneSnapshot: (
			snapshot: CanvasSceneSnapshot,
			options?: ApplySceneSnapshotOptions,
		) => void,
	) => void;
	saveOverlayDraft: () => void;
	applyOverlayDraft: () => void;
	copyRegisteredLayout: () => void;

	// Overlay placement actions
	updateOverlayDraft: (
		patch: Partial<Omit<CanvasTourGuideOverlay, 'placement'>> & {
			placement?: Partial<CanvasTourGuideOverlay['placement']>;
		},
	) => void;
	updateOverlayPlacement: (key: keyof CanvasTourGuideOverlay['placement'], value: number) => void;
	nudgeOverlayPlacement: (
		key: keyof Pick<CanvasTourGuideOverlay['placement'], 'leftRem' | 'topRem'>,
		delta: number,
	) => void;
	applyOverlayPreset: (preset: OverlayPlacementPreset) => void;
	setRegistrySceneId: React.Dispatch<React.SetStateAction<string>>;
	setRegistryCaptureMode: React.Dispatch<React.SetStateAction<'full' | 'camera' | 'elements'>>;
}

function getChapterById(sceneId: string, fallback: CanvasTourChapter): CanvasTourChapter {
	return canvasTourChapters.find((chapter) => chapter.id === sceneId) ?? fallback;
}

export function useCanvasTourPageState(): CanvasTourPageState {
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

	const [guideBaseline, setGuideBaseline] = useState(() => ({
		elements: initialRegisteredScene?.elements ?? defaultScene.elements,
		camera: initialRegisteredScene?.camera ?? activeChapter.camera,
	}));

	const [guideOverlay, setGuideOverlay] = useState<CanvasTourGuideOverlay>(
		initialRegisteredScene?.overlay ?? defaultOverlay,
	);

	const [isGuideMode, setIsGuideMode] = useState(true);
	const [isGridVisible, setIsGridVisible] = useState(true);
	const [activeTool, setActiveTool] = useState<TourTool>('selection');
	const [devCaptureStatus, setDevCaptureStatus] = useState<string | null>(null);
	const [isRegistryOpen, setIsRegistryOpen] = useState(false);
	const [surfaceEpoch, setSurfaceEpoch] = useState(0);
	const [registrySceneId, setRegistrySceneId] = useState(defaultSceneId);
	const [registryCaptureMode, setRegistryCaptureMode] = useState<'full' | 'camera' | 'elements'>(
		'full',
	);
	const [overlayDraft, setOverlayDraft] = useState<CanvasTourGuideOverlay>(
		initialRegisteredScene?.overlay ?? defaultOverlay,
	);

	const layoutPanelRef = useRef<HTMLDivElement | null>(null);
	const overlayShellRef = useRef<HTMLDivElement | null>(null);
	const stageViewportRef = useRef<HTMLDivElement | null>(null);

	const [overlayShellHeightPx, setOverlayShellHeightPx] = useState(0);
	const [stageViewportSize, setStageViewportSize] = useState({ widthPx: 0, heightPx: 0 });

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

	// Use mount effect for viewport measurement with ResizeObserver
	useMountEffect(() => {
		if (typeof window === 'undefined') return;
		const root = document.documentElement;
		const stageNode = stageViewportRef.current;
		if (!stageNode) return;

		const measure = () => {
			const rect = stageNode.getBoundingClientRect();
			setStageViewportSize({
				widthPx: rect.width,
				heightPx: rect.height,
			});
		};

		measure();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', measure);
			return () => window.removeEventListener('resize', measure);
		}
		const observer = new ResizeObserver(() => measure());
		observer.observe(stageNode);
		observer.observe(root);
		return () => observer.disconnect();
	});

	// Use mount effect for overlay shell measurement with ResizeObserver
	// Re-run when dependencies change by using a key ref pattern
	const shellMeasureKey = `${isGuideMode}:${isRegistryOpen}:${registrySceneId}`;
	const prevShellMeasureKeyRef = useRef(shellMeasureKey);
	useMountEffect(() => {
		if (typeof window === 'undefined') return;
		const shellNode = overlayShellRef.current;
		if (!shellNode) {
			setOverlayShellHeightPx(0);
			return;
		}

		const measure = () => setOverlayShellHeightPx(shellNode.getBoundingClientRect().height);
		measure();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', measure);
			return () => window.removeEventListener('resize', measure);
		}
		const observer = new ResizeObserver(() => measure());
		observer.observe(shellNode);
		return () => observer.disconnect();
	});
	// Re-measure shell when key changes (derived state pattern)
	if (shellMeasureKey !== prevShellMeasureKeyRef.current) {
		prevShellMeasureKeyRef.current = shellMeasureKey;
		if (typeof window !== 'undefined' && overlayShellRef.current) {
			setOverlayShellHeightPx(overlayShellRef.current.getBoundingClientRect().height);
		}
	}

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

	// Actions
	const resetDemo = useCallback(() => {
		setIsRegistryOpen(false);
		setIsGuideMode(true);
		setSurfaceEpoch((current) => current + 1);
		setActiveTool('selection');
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}, []);

	const enterGuideMode = useCallback(
		(getCurrentSceneSnapshot: () => CanvasSceneSnapshot) => {
			if (isGuideMode) return;
			// Explore session snapshot is handled by the caller
			void getCurrentSceneSnapshot;
			setIsGuideMode(true);
			setIsRegistryOpen(false);
			setSurfaceEpoch((current) => current + 1);
			setActiveTool('selection');
		},
		[isGuideMode],
	);

	const enterExploreMode = useCallback(
		(
			getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
			getExploreSessionSnapshot: () => CanvasSceneSnapshot | null,
		) => {
			if (!isGuideMode) return;
			setIsGuideMode(false);
			setSurfaceEpoch((current) => current + 1);
			const exploreSession = getExploreSessionSnapshot();
			if (exploreSession) {
				const nextTool = exploreSession.appState.activeTool?.type;
				if (
					nextTool === 'hand' ||
					nextTool === 'selection' ||
					nextTool === 'rectangle' ||
					nextTool === 'diamond' ||
					nextTool === 'ellipse' ||
					nextTool === 'arrow' ||
					nextTool === 'line' ||
					nextTool === 'freedraw' ||
					nextTool === 'text' ||
					nextTool === 'image' ||
					nextTool === 'eraser'
				) {
					setActiveTool(nextTool);
					return;
				}
			}
			void getCurrentSceneSnapshot;
			setActiveTool('selection');
		},
		[isGuideMode],
	);

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
		[activeChapter.id, getRegisteredSceneForId, isGuideMode, registrySceneId, resolveChapter],
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

	// Overlay placement computed values
	const rootFontSizePx = useMemo(() => getRootFontSizePx(), []);
	const overlayHeightPx =
		overlayShellHeightPx > 0 ? overlayShellHeightPx : OVERLAY_DEFAULT_HEIGHT_REM * rootFontSizePx;
	const layoutPanelWidthPx =
		IS_DEV && !isGuideMode && isRegistryOpen && layoutPanelRef.current
			? layoutPanelRef.current.getBoundingClientRect().width
			: 0;

	const guideSafeArea = useMemo(
		() => buildSafeArea(false, stageViewportSize, layoutPanelWidthPx, rootFontSizePx),
		[layoutPanelWidthPx, rootFontSizePx, stageViewportSize],
	);
	const editorSafeArea = useMemo(
		() =>
			buildSafeArea(
				IS_DEV && !isGuideMode && isRegistryOpen,
				stageViewportSize,
				layoutPanelWidthPx,
				rootFontSizePx,
			),
		[isRegistryOpen, isGuideMode, layoutPanelWidthPx, rootFontSizePx, stageViewportSize],
	);

	const overlayPlacementBounds = useMemo(
		() => buildOverlayPlacementBounds(guideSafeArea, rootFontSizePx),
		[guideSafeArea, rootFontSizePx],
	);

	const visibleOverlay = useMemo(() => {
		if (!isGuideMode && isRegistryOpen && registrySceneId === activeChapter.id) {
			return overlayDraft;
		}
		return guideOverlay;
	}, [isGuideMode, isRegistryOpen, registrySceneId, activeChapter.id, overlayDraft, guideOverlay]);

	const clampPlacement = useCallback(
		(placement: CanvasTourGuideOverlay['placement'], area: OverlaySafeArea) => {
			return clampOverlayPlacement(placement, area, overlayHeightPx, rootFontSizePx);
		},
		[overlayHeightPx, rootFontSizePx],
	);

	const guidePlacement = useMemo(
		() => clampPlacement(visibleOverlay.placement, guideSafeArea),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[visibleOverlay.placement, guideSafeArea, clampPlacement],
	);
	const previewPlacement = useMemo(
		() => clampPlacement(guidePlacement, editorSafeArea),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[guidePlacement, editorSafeArea, clampPlacement],
	);

	const displayedPlacement = useMemo(() => {
		if (!isGuideMode && isRegistryOpen && registrySceneId === activeChapter.id) {
			return previewPlacement;
		}
		return guidePlacement;
	}, [
		isGuideMode,
		isRegistryOpen,
		registrySceneId,
		activeChapter.id,
		previewPlacement,
		guidePlacement,
	]);

	const introOverlayStyle = useMemo(
		() =>
			({
				'--overlay-accent': visibleOverlay.accentColor,
				'--overlay-surface-opacity': visibleOverlay.surfaceOpacity.toString(),
				left: `${displayedPlacement.leftRem}rem`,
				top: `${displayedPlacement.topRem}rem`,
				width: `${displayedPlacement.widthRem}rem`,
			}) as React.CSSProperties,
		[visibleOverlay.accentColor, visibleOverlay.surfaceOpacity, displayedPlacement],
	);

	// Overlay placement actions
	const updateOverlayDraft = useCallback(
		(
			patch: Partial<Omit<CanvasTourGuideOverlay, 'placement'>> & {
				placement?: Partial<CanvasTourGuideOverlay['placement']>;
			},
		) => {
			setOverlayDraft((current) => ({
				...current,
				...patch,
				placement: patch.placement
					? { ...current.placement, ...patch.placement }
					: current.placement,
			}));
		},
		[],
	);

	const updateOverlayPlacement = useCallback(
		(key: keyof CanvasTourGuideOverlay['placement'], value: number) => {
			const normalizedValue =
				key === 'widthRem'
					? clamp(value, overlayPlacementBounds.widthMinRem, overlayPlacementBounds.widthMaxRem)
					: key === 'leftRem'
						? clamp(value, overlayPlacementBounds.leftMinRem, overlayPlacementBounds.leftMaxRem)
						: clamp(value, overlayPlacementBounds.topMinRem, overlayPlacementBounds.topMaxRem);
			updateOverlayDraft({
				placement: {
					[key]: normalizedValue,
				} as Partial<CanvasTourGuideOverlay['placement']>,
			});
		},
		[overlayPlacementBounds, updateOverlayDraft],
	);

	const nudgeOverlayPlacement = useCallback(
		(key: keyof Pick<CanvasTourGuideOverlay['placement'], 'leftRem' | 'topRem'>, delta: number) => {
			updateOverlayPlacement(key, overlayDraft.placement[key] + delta);
		},
		[overlayDraft.placement, updateOverlayPlacement],
	);

	const applyOverlayPreset = useCallback(
		(preset: OverlayPlacementPreset) => {
			const nextPlacement = calculateOverlayPreset(
				preset,
				guideSafeArea,
				overlayHeightPx,
				rootFontSizePx,
				overlayPlacementBounds,
			);
			updateOverlayDraft({ placement: clampPlacement(nextPlacement, guideSafeArea) });
		},
		[
			guideSafeArea,
			overlayHeightPx,
			rootFontSizePx,
			overlayPlacementBounds,
			updateOverlayDraft,
			clampPlacement,
		],
	);

	const showRegistryControls = IS_DEV && !isGuideMode;
	const selectedRegistryChapter = resolveChapter(registrySceneId);
	const selectedRegisteredScene = getRegisteredSceneForId(registrySceneId);

	return {
		imageId,
		activeChapter,
		defaultScene,
		stageViewportRef,
		overlayShellRef,
		layoutPanelRef,
		isGuideMode,
		isGridVisible,
		activeTool,
		surfaceEpoch,
		isRegistryOpen,
		registeredSceneLibrary,
		registrySceneId,
		registryCaptureMode,
		guideBaseline,
		guideOverlay,
		overlayDraft,
		devCaptureStatus,
		stageViewportSize,
		overlayShellHeightPx,
		rootFontSizePx,
		guideSafeArea,
		editorSafeArea,
		overlayPlacementBounds,
		guidePlacement,
		previewPlacement,
		displayedPlacement,
		visibleOverlay,
		introOverlayStyle,
		showRegistryControls,
		selectedRegistryChapter,
		selectedRegisteredScene,
		resetDemo,
		enterGuideMode,
		enterExploreMode,
		setIsGridVisible,
		setActiveTool,
		setIsRegistryOpen,
		setStageViewportSize,
		registerCurrentLayout,
		restoreRegisteredLayout,
		clearRegisteredLayout,
		saveOverlayDraft,
		applyOverlayDraft,
		copyRegisteredLayout,
		updateOverlayDraft,
		updateOverlayPlacement,
		nudgeOverlayPlacement,
		applyOverlayPreset,
		setRegistrySceneId,
		setRegistryCaptureMode,
	};
}
