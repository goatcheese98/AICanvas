import { CanvasNotesLayer } from '@/components/canvas/CanvasNotesLayer';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import { CanvasTourLayoutPanel } from './CanvasTourLayoutPanel';
import { CanvasTourToolbar } from './CanvasTourToolbar';
import { canvasTourChapters } from './canvas-tour-content';
import { TOUR_IMAGE_FILE_ID, createCanvasTourScene } from './canvas-tour-scene';
import { useCanvasTourPageState } from './useCanvasTourPageState';
import type { ApplySceneSnapshotOptions } from './useCanvasTourSceneController';
import { useCanvasTourSceneController } from './useCanvasTourSceneController';
import './canvas-tour.css';

export function CanvasTourPage() {
	const state = useCanvasTourPageState();
	const {
		activeChapter,
		stageViewportRef,
		overlayShellRef,
		layoutPanelRef,
		isGuideMode,
		isGridVisible,
		activeTool,
		surfaceEpoch,
		isRegistryOpen,
		registrySceneId,
		registryCaptureMode,
		guideBaseline,
		overlayDraft,
		devCaptureStatus,
		visibleOverlay,
		introOverlayStyle,
		showRegistryControls,
		selectedRegistryChapter,
		selectedRegisteredScene,
		guidePlacement,
		previewPlacement,
		guideSafeArea,
		editorSafeArea,
		overlayPlacementBounds,
		rootFontSizePx,
		resetDemo,
		enterGuideMode,
		enterExploreMode,
		setIsGridVisible,
		setActiveTool,
		setIsRegistryOpen,
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
	} = state;

	const defaultScene = createCanvasTourScene(TOUR_IMAGE_FILE_ID);

	// Cast guideBaseline.elements to the correct type for the controller
	const typedGuideBaseline = {
		elements: guideBaseline.elements as ExcalidrawElement[],
		camera: guideBaseline.camera,
	};

	const {
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
		imageId: TOUR_IMAGE_FILE_ID,
		defaultScene,
		stageViewportRef,
		guideBaseline: typedGuideBaseline,
		initialCamera: typedGuideBaseline.camera,
		isGuideMode,
		surfaceEpoch,
		setActiveTool,
	});

	const handleEnterGuideMode = () => {
		// Store explore session before switching
		if (!isGuideMode) {
			setExploreSessionSnapshot(getCurrentSceneSnapshot());
		}
		enterGuideMode(getCurrentSceneSnapshot);
	};

	const handleEnterExploreMode = () => {
		enterExploreMode(getCurrentSceneSnapshot, getExploreSessionSnapshot);
	};

	const handleRegisterCurrentLayout = () => {
		registerCurrentLayout(getCurrentSceneSnapshot, createCameraFromAppState, applySceneSnapshot);
	};

	const handleRestoreRegisteredLayout = () => {
		restoreRegisteredLayout(
			imageFileData,
			buildGuideAppState,
			buildExploreAppState,
			(snapshot, opts) => applySceneSnapshot(snapshot, opts as ApplySceneSnapshotOptions),
			setExploreSessionSnapshot,
		);
	};

	const handleClearRegisteredLayout = () => {
		clearRegisteredLayout(imageFileData, buildGuideAppState, (snapshot, opts) =>
			applySceneSnapshot(snapshot, opts as ApplySceneSnapshotOptions),
		);
	};

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
								onClick={handleEnterGuideMode}
							>
								Guide mode
							</button>
							<button
								type="button"
								className={!isGuideMode ? 'canvas-tour-toggle-active' : ''}
								onClick={handleEnterExploreMode}
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
					<CanvasNotesLayer canvasId="canvas-tour" />
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
									Math.abs(previewPlacement.leftRem - guidePlacement.leftRem) > 0.05 ||
									Math.abs(previewPlacement.topRem - guidePlacement.topRem) > 0.05,
								previewShiftXRem: previewPlacement.leftRem - guidePlacement.leftRem,
								previewShiftYRem: previewPlacement.topRem - guidePlacement.topRem,
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
							registerCurrentLayout={handleRegisterCurrentLayout}
							restoreRegisteredLayout={handleRestoreRegisteredLayout}
							copyRegisteredLayout={copyRegisteredLayout}
							clearRegisteredLayout={handleClearRegisteredLayout}
							ref={layoutPanelRef}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}
