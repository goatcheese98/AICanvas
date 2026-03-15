import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { CanvasNotesLayer } from '@/components/canvas/CanvasNotesLayer';
import '@excalidraw/excalidraw/index.css';
import {
	canvasTourChapters,
	type CanvasTourChapter,
	type CanvasTourGuideOverlay,
} from './canvas-tour-content';
import { CanvasTourLayoutPanel } from './CanvasTourLayoutPanel';
import { CanvasTourToolbar } from './CanvasTourToolbar';
import {
	clearRegisteredTourScenes,
	loadRegisteredTourScenes,
	persistRegisteredTourScenes,
	type RegisteredTourSceneLibrary,
	type RegisteredTourSceneSnapshot,
} from './canvas-tour-registry';
import { createCanvasTourScene, TOUR_IMAGE_FILE_ID } from './canvas-tour-scene';
import {
	getTourTool,
	useCanvasTourSceneController,
	type CanvasSceneSnapshot,
	type TourTool,
} from './useCanvasTourSceneController';
import './canvas-tour.css';

const IS_DEV = import.meta.env.DEV;

function getChapterById(sceneId: string, fallback: CanvasTourChapter) {
	return canvasTourChapters.find((chapter) => chapter.id === sceneId) ?? fallback;
}

type OverlayPlacementPreset = 'top-left' | 'top-center' | 'top-right' | 'bottom-left';

type OverlayPlacementBounds = {
	leftMinRem: number;
	leftMaxRem: number;
	topMinRem: number;
	topMaxRem: number;
	widthMinRem: number;
	widthMaxRem: number;
};

type OverlaySafeArea = {
	leftPx: number;
	topPx: number;
	rightPx: number;
	bottomPx: number;
	widthPx: number;
	heightPx: number;
};

const OVERLAY_LEFT_MARGIN_REM = 1.2;
const OVERLAY_TOP_MARGIN_REM = 1.2;
const OVERLAY_RIGHT_MARGIN_REM = 1.2;
const OVERLAY_BOTTOM_MARGIN_REM = 1.2;
const OVERLAY_MIN_WIDTH_REM = 11;
const OVERLAY_DEFAULT_HEIGHT_REM = 22;
const OVERLAY_MAX_WIDTH_REM = 26;

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function CanvasTourPage() {
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
	const initialCamera = guideBaseline.camera;
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
	const [overlayShellHeightPx, setOverlayShellHeightPx] = useState(0);
	const [stageViewportSize, setStageViewportSize] = useState({ widthPx: 0, heightPx: 0 });
	const resolveChapter = (sceneId: string) => getChapterById(sceneId, activeChapter);

	const getDefaultSceneForId = (sceneId: string): RegisteredTourSceneSnapshot => {
		const chapter = resolveChapter(sceneId);
		return {
			sceneId,
			elements: defaultScene.elements,
			camera: chapter.camera,
			overlay: chapter.overlay,
			capturedAt: new Date(0).toISOString(),
		};
	};

	const getRegisteredSceneForId = (sceneId: string) =>
		registeredSceneLibrary?.scenes[sceneId] ?? null;
	const {
		stageViewportRef,
		imageFileData,
		liveCamera,
		excalidrawMountKey,
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
	} = useCanvasTourSceneController({
		imageId,
		defaultScene,
		guideBaseline,
		initialCamera,
		isGuideMode,
		surfaceEpoch,
		setActiveTool,
	});

	useEffect(() => {
		const nextOverlay =
			getRegisteredSceneForId(registrySceneId)?.overlay ?? resolveChapter(registrySceneId).overlay;
		setOverlayDraft(nextOverlay);
	}, [registeredSceneLibrary, registrySceneId]);

	useEffect(() => {
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
	}, [stageViewportRef]);

	useEffect(() => {
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
	}, [isGuideMode, isRegistryOpen, registrySceneId, overlayDraft, guideOverlay]);

	const resetDemo = () => {
		setExploreSessionSnapshot(null);
		setIsRegistryOpen(false);
		setIsGuideMode(true);
		setSurfaceEpoch((current) => current + 1);
		setActiveTool('selection');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const enterGuideMode = () => {
		if (isGuideMode) return;
		setExploreSessionSnapshot(getCurrentSceneSnapshot());
		setIsGuideMode(true);
		setIsRegistryOpen(false);
		setSurfaceEpoch((current) => current + 1);
		setActiveTool('selection');
	};

	const enterExploreMode = () => {
		if (!isGuideMode) return;
		setIsGuideMode(false);
		setSurfaceEpoch((current) => current + 1);
		const exploreSession = getExploreSessionSnapshot();
		if (exploreSession) {
			const nextTool = getTourTool(exploreSession.appState.activeTool?.type);
			setActiveTool(nextTool ?? 'selection');
			return;
		}
		setActiveTool('selection');
	};

	const registerCurrentLayout = () => {
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
	};

	const restoreRegisteredLayout = () => {
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
	};

	const clearRegisteredLayout = () => {
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
	};

	const saveOverlayDraft = () => {
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
	};

	const applyOverlayDraft = () => {
		if (registrySceneId === activeChapter.id) {
			setGuideOverlay(overlayDraft);
			setDevCaptureStatus('Overlay draft is now live on the active scene.');
			return;
		}
		setDevCaptureStatus('Overlay draft updated. Save it to register this scene.');
	};

	const copyRegisteredLayout = async () => {
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
	};

	const showRegistryControls = IS_DEV && !isGuideMode;
	const selectedRegistryChapter = resolveChapter(registrySceneId);
	const selectedRegisteredScene = getRegisteredSceneForId(registrySceneId);
	const visibleOverlay =
		!isGuideMode && isRegistryOpen && registrySceneId === activeChapter.id
			? overlayDraft
			: guideOverlay;
	const rootFontSizePx =
		typeof window === 'undefined'
			? 16
			: Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
	const overlayHeightPx =
		overlayShellHeightPx > 0 ? overlayShellHeightPx : OVERLAY_DEFAULT_HEIGHT_REM * rootFontSizePx;
	const layoutPanelWidthPx =
		showRegistryControls && isRegistryOpen && layoutPanelRef.current
			? layoutPanelRef.current.getBoundingClientRect().width
			: 0;
	const buildSafeArea = (reserveLayoutPanel: boolean): OverlaySafeArea => {
		const leftPx = OVERLAY_LEFT_MARGIN_REM * rootFontSizePx;
		const topPx = OVERLAY_TOP_MARGIN_REM * rootFontSizePx;
		const rightInsetPx =
			(reserveLayoutPanel ? layoutPanelWidthPx + 20 : 0) +
			OVERLAY_RIGHT_MARGIN_REM * rootFontSizePx;
		const bottomInsetPx = OVERLAY_BOTTOM_MARGIN_REM * rootFontSizePx;
		const rightPx = Math.max(leftPx, stageViewportSize.widthPx - rightInsetPx);
		const bottomPx = Math.max(topPx + 120, stageViewportSize.heightPx - bottomInsetPx);
		return {
			leftPx,
			topPx,
			rightPx,
			bottomPx,
			widthPx: Math.max(0, rightPx - leftPx),
			heightPx: Math.max(0, bottomPx - topPx),
		};
	};
	const guideSafeArea = buildSafeArea(false);
	const editorSafeArea = buildSafeArea(showRegistryControls && isRegistryOpen);
	const overlayPlacementBounds: OverlayPlacementBounds = {
		leftMinRem: OVERLAY_LEFT_MARGIN_REM,
		leftMaxRem: Math.max(
			OVERLAY_LEFT_MARGIN_REM,
			(guideSafeArea.rightPx - OVERLAY_MIN_WIDTH_REM * rootFontSizePx) / rootFontSizePx,
		),
		topMinRem: OVERLAY_TOP_MARGIN_REM,
		topMaxRem: Math.max(
			OVERLAY_TOP_MARGIN_REM,
			(guideSafeArea.bottomPx - overlayHeightPx) / rootFontSizePx,
		),
		widthMinRem: OVERLAY_MIN_WIDTH_REM,
		widthMaxRem: Math.max(
			OVERLAY_MIN_WIDTH_REM,
			Math.min(OVERLAY_MAX_WIDTH_REM, guideSafeArea.widthPx / rootFontSizePx),
		),
	};
	const clampOverlayPlacement = (
		placement: CanvasTourGuideOverlay['placement'],
		area: OverlaySafeArea,
	) => {
		const widthRem = clamp(
			placement.widthRem,
			OVERLAY_MIN_WIDTH_REM,
			Math.max(
				OVERLAY_MIN_WIDTH_REM,
				Math.min(OVERLAY_MAX_WIDTH_REM, area.widthPx / rootFontSizePx),
			),
		);
		const widthPx = widthRem * rootFontSizePx;
		const maxLeftRem = Math.max(OVERLAY_LEFT_MARGIN_REM, (area.rightPx - widthPx) / rootFontSizePx);
		const maxTopRem = Math.max(
			OVERLAY_TOP_MARGIN_REM,
			(area.bottomPx - overlayHeightPx) / rootFontSizePx,
		);
		return {
			leftRem: clamp(placement.leftRem, OVERLAY_LEFT_MARGIN_REM, maxLeftRem),
			topRem: clamp(placement.topRem, OVERLAY_TOP_MARGIN_REM, maxTopRem),
			widthRem,
		};
	};
	const guidePlacement = clampOverlayPlacement(visibleOverlay.placement, guideSafeArea);
	const previewPlacement = clampOverlayPlacement(guidePlacement, editorSafeArea);
	const previewShiftXRem = previewPlacement.leftRem - guidePlacement.leftRem;
	const previewShiftYRem = previewPlacement.topRem - guidePlacement.topRem;
	const displayedPlacement =
		!isGuideMode && isRegistryOpen && registrySceneId === activeChapter.id
			? previewPlacement
			: guidePlacement;
	const updateOverlayDraft = (
		patch: Partial<Omit<CanvasTourGuideOverlay, 'placement'>> & {
			placement?: Partial<CanvasTourGuideOverlay['placement']>;
		},
	) => {
		setOverlayDraft((current) => ({
			...current,
			...patch,
			placement: patch.placement ? { ...current.placement, ...patch.placement } : current.placement,
		}));
	};
	const updateOverlayPlacement = (
		key: keyof CanvasTourGuideOverlay['placement'],
		value: number,
	) => {
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
	};
	const nudgeOverlayPlacement = (
		key: keyof Pick<CanvasTourGuideOverlay['placement'], 'leftRem' | 'topRem'>,
		delta: number,
	) => {
		updateOverlayPlacement(key, overlayDraft.placement[key] + delta);
	};
	const applyOverlayPreset = (preset: OverlayPlacementPreset) => {
		const targetWidthRem =
			preset === 'top-center'
				? clamp(17, overlayPlacementBounds.widthMinRem, overlayPlacementBounds.widthMaxRem)
				: clamp(16, overlayPlacementBounds.widthMinRem, overlayPlacementBounds.widthMaxRem);
		const targetWidthPx = targetWidthRem * rootFontSizePx;
		const leftEdgeRem = guideSafeArea.leftPx / rootFontSizePx;
		const rightEdgeRem = Math.max(
			OVERLAY_LEFT_MARGIN_REM,
			(guideSafeArea.rightPx - targetWidthPx) / rootFontSizePx,
		);
		const centeredLeftRem = clamp(
			(guideSafeArea.leftPx + (guideSafeArea.widthPx - targetWidthPx) / 2) / rootFontSizePx,
			overlayPlacementBounds.leftMinRem,
			overlayPlacementBounds.leftMaxRem,
		);
		const topEdgeRem = guideSafeArea.topPx / rootFontSizePx;
		const bottomEdgeRem = Math.max(
			OVERLAY_TOP_MARGIN_REM,
			(guideSafeArea.bottomPx - overlayHeightPx) / rootFontSizePx,
		);
		const nextPlacement =
			preset === 'top-left'
				? { leftRem: leftEdgeRem, topRem: topEdgeRem, widthRem: targetWidthRem }
				: preset === 'top-center'
					? { leftRem: centeredLeftRem, topRem: topEdgeRem, widthRem: targetWidthRem }
					: preset === 'top-right'
						? { leftRem: rightEdgeRem, topRem: topEdgeRem, widthRem: targetWidthRem }
						: { leftRem: leftEdgeRem, topRem: bottomEdgeRem, widthRem: targetWidthRem };
		updateOverlayDraft({ placement: clampOverlayPlacement(nextPlacement, guideSafeArea) });
	};
	const introOverlayStyle = {
		'--overlay-accent': visibleOverlay.accentColor,
		'--overlay-surface-opacity': visibleOverlay.surfaceOpacity.toString(),
		left: `${displayedPlacement.leftRem}rem`,
		top: `${displayedPlacement.topRem}rem`,
		width: `${displayedPlacement.widthRem}rem`,
	} as CSSProperties;

	return (
		<div className="canvas-tour-page">
			<div className="canvas-tour-stage">
				<div className="canvas-tour-stage-bar">
					<div className="canvas-tour-stage-brand">
						<div className="canvas-tour-stage-dots" aria-hidden="true">
							<span />
							<span />
							<span />
						</div>
						<a className="canvas-tour-stage-wordmark" href="/">
							RoopStudio
						</a>
					</div>
					<div className="canvas-tour-stage-actions">
						<div className="canvas-tour-toggle" role="tablist" aria-label="Canvas tour mode">
							<button
								type="button"
								className={isGuideMode ? 'canvas-tour-toggle-active' : ''}
								onClick={enterGuideMode}
							>
								Guide mode
							</button>
							<button
								type="button"
								className={!isGuideMode ? 'canvas-tour-toggle-active' : ''}
								onClick={enterExploreMode}
							>
								Explore demo
							</button>
						</div>
						<button
							type="button"
							className={`canvas-tour-reset ${isGridVisible ? 'canvas-tour-toggle-active' : ''}`}
							onClick={() => setIsGridVisible((current) => !current)}
						>
							{isGridVisible ? 'Hide grid' : 'Show grid'}
						</button>
						<button type="button" className="canvas-tour-reset" onClick={resetDemo}>
							Reset demo
						</button>
						{showRegistryControls ? (
							<button
								type="button"
								className={`canvas-tour-reset ${isRegistryOpen ? 'canvas-tour-toggle-active' : ''}`}
								onClick={() => setIsRegistryOpen((current) => !current)}
							>
								Layout tools
							</button>
						) : null}
						<a className="canvas-tour-stage-link" href="/">
							Back to landing
						</a>
						<a className="canvas-tour-reset canvas-tour-stage-cta" href="/login">
							Sign in
						</a>
					</div>
				</div>

				<div ref={stageViewportRef} className="canvas-tour-viewport">
					<CanvasTourToolbar
						activeTool={activeTool}
						isGuideMode={isGuideMode}
						onSelectTool={handleToolSelect}
					/>
					<div className="canvas-tour-excalidraw">
						<Excalidraw
							key={excalidrawMountKey}
							excalidrawAPI={handleExcalidrawApiReady}
							initialData={initialSurfaceData}
							isCollaborating
							detectScroll={false}
							handleKeyboardGlobally={false}
							gridModeEnabled={isGridVisible}
							viewModeEnabled={isGuideMode}
							onChange={handleExcalidrawChange}
							UIOptions={{
								canvasActions: {
									loadScene: false,
									saveToActiveFile: false,
								},
							}}
						/>
					</div>
					<CanvasNotesLayer />
					{isGuideMode ? <div className="canvas-tour-interaction-mask" aria-hidden="true" /> : null}

					{isGuideMode ||
					(showRegistryControls && isRegistryOpen && registrySceneId === activeChapter.id) ? (
						<div
							ref={overlayShellRef}
							className="canvas-tour-intro-shell"
							style={introOverlayStyle}
						>
							<svg
								className="canvas-tour-intro-outline"
								viewBox="0 0 100 100"
								preserveAspectRatio="none"
								aria-hidden="true"
							>
								<rect
									className="canvas-tour-intro-outline-base"
									x="2"
									y="2"
									width="96"
									height="96"
									rx="8"
									ry="8"
								/>
								<rect
									className="canvas-tour-intro-outline-runner canvas-tour-intro-outline-runner-a"
									x="2"
									y="2"
									width="96"
									height="96"
									rx="8"
									ry="8"
									pathLength="100"
								/>
								<rect
									className="canvas-tour-intro-outline-runner canvas-tour-intro-outline-runner-b"
									x="2"
									y="2"
									width="96"
									height="96"
									rx="8"
									ry="8"
									pathLength="100"
								/>
							</svg>
							<div className="canvas-tour-intro-card">
								<p className="canvas-tour-intro-label">{visibleOverlay.label}</p>
								<h2 className="canvas-tour-intro-title">{visibleOverlay.title}</h2>
								<p className="canvas-tour-intro-copy">{visibleOverlay.description}</p>
								<p className="canvas-tour-intro-hint">{visibleOverlay.hint}</p>
							</div>
						</div>
					) : null}

					<div className="canvas-tour-ai canvas-tour-ai-visible canvas-tour-ai-idle">
						<p className="canvas-tour-ai-kicker">AI assistant</p>
						<p className="canvas-tour-ai-placeholder">{activeChapter.ai?.placeholder}</p>
					</div>

					{!isGuideMode ? (
						<div className="canvas-tour-explore-badge">
							Explore mode: drag items and inspect the demo.
						</div>
					) : null}

					{showRegistryControls && isRegistryOpen ? (
						<CanvasTourLayoutPanel
							canvasTourChapters={canvasTourChapters}
							devCaptureStatus={devCaptureStatus}
							liveCamera={liveCamera}
							overlayDraft={overlayDraft}
							overlayPlacementBounds={overlayPlacementBounds}
							overlayPlacementMeta={{
								guideWidthRem: guideSafeArea.widthPx / rootFontSizePx,
								guideHeightRem: guideSafeArea.heightPx / rootFontSizePx,
								editorWidthRem: editorSafeArea.widthPx / rootFontSizePx,
								editorHeightRem: editorSafeArea.heightPx / rootFontSizePx,
								panelAwarePreview:
									Math.abs(previewShiftXRem) > 0.05 || Math.abs(previewShiftYRem) > 0.05,
								previewShiftXRem,
								previewShiftYRem,
							}}
							registryCaptureMode={registryCaptureMode}
							registrySceneId={registrySceneId}
							selectedRegisteredScene={selectedRegisteredScene}
							selectedRegistryChapter={selectedRegistryChapter}
							setRegistryCaptureMode={setRegistryCaptureMode}
							setRegistrySceneId={setRegistrySceneId}
							updateOverlayDraft={updateOverlayDraft}
							updateOverlayPlacement={updateOverlayPlacement}
							nudgeOverlayPlacement={nudgeOverlayPlacement}
							applyOverlayPreset={applyOverlayPreset}
							applyOverlayDraft={applyOverlayDraft}
							saveOverlayDraft={saveOverlayDraft}
							registerCurrentLayout={registerCurrentLayout}
							restoreRegisteredLayout={restoreRegisteredLayout}
							copyRegisteredLayout={copyRegisteredLayout}
							clearRegisteredLayout={clearRegisteredLayout}
							ref={layoutPanelRef}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}
