/**
 * Shared types for canvas tour hooks.
 *
 * Container/Hook/Child Pattern:
 * - Types are defined here and imported by all hooks
 * - No implementation logic, only type definitions
 */

import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import type {
	OverlayPlacementBounds,
	OverlayPlacementPreset,
	OverlaySafeArea,
} from './canvas-tour-page-utils';
import type {
	RegisteredTourSceneLibrary,
	RegisteredTourSceneSnapshot,
} from './canvas-tour-registry';
import type {
	ApplySceneSnapshotOptions,
	CameraTarget,
	CanvasSceneSnapshot,
	TourTool,
} from './tour-types';

// =============================================================================
// Core Refs and Data
// =============================================================================

interface CanvasTourCoreRefs {
	imageId: BinaryFileData['id'];
	activeChapter: CanvasTourChapter;
	defaultScene: { elements: unknown[]; imageId: BinaryFileData['id'] };
	stageViewportRef: React.RefObject<HTMLDivElement | null>;
	overlayShellRef: React.RefObject<HTMLDivElement | null>;
	layoutPanelRef: React.RefObject<HTMLDivElement | null>;
}

// =============================================================================
// Navigation State (from useCanvasTourNavigation)
// =============================================================================

export interface CanvasTourNavigationState {
	isGuideMode: boolean;
	isGridVisible: boolean;
	activeTool: TourTool;
	surfaceEpoch: number;
	isRegistryOpen: boolean;
}

export interface CanvasTourNavigationActions {
	resetDemo: () => void;
	enterGuideMode: (getCurrentSceneSnapshot: () => CanvasSceneSnapshot) => void;
	enterExploreMode: (
		getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
		getExploreSessionSnapshot: () => CanvasSceneSnapshot | null,
	) => void;
	setIsGridVisible: React.Dispatch<React.SetStateAction<boolean>>;
	setActiveTool: React.Dispatch<React.SetStateAction<TourTool>>;
	setIsRegistryOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// =============================================================================
// Registry State (from useCanvasTourRegistry)
// =============================================================================

export interface CanvasTourRegistryState {
	registeredSceneLibrary: RegisteredTourSceneLibrary | null;
	registrySceneId: string;
	registryCaptureMode: 'full' | 'camera' | 'elements';
	guideBaseline: { elements: unknown[]; camera: CameraTarget };
	guideOverlay: CanvasTourGuideOverlay;
	overlayDraft: CanvasTourGuideOverlay;
	devCaptureStatus: string | null;
}

export interface CanvasTourRegistryActions {
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
	setRegistrySceneId: React.Dispatch<React.SetStateAction<string>>;
	setRegistryCaptureMode: React.Dispatch<React.SetStateAction<'full' | 'camera' | 'elements'>>;
}

// =============================================================================
// Overlay Placement State (from useOverlayPlacement)
// =============================================================================

export interface CanvasTourOverlayMeasurementState {
	stageViewportSize: { widthPx: number; heightPx: number };
	overlayShellHeightPx: number;
	rootFontSizePx: number;
	guideSafeArea: OverlaySafeArea;
	editorSafeArea: OverlaySafeArea;
	overlayPlacementBounds: OverlayPlacementBounds;
}

export interface CanvasTourOverlayPlacementState {
	guidePlacement: CanvasTourGuideOverlay['placement'];
	previewPlacement: CanvasTourGuideOverlay['placement'];
	displayedPlacement: CanvasTourGuideOverlay['placement'];
	visibleOverlay: CanvasTourGuideOverlay;
	introOverlayStyle: React.CSSProperties;
}

export interface CanvasTourOverlayPlacementActions {
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
	setStageViewportSize: React.Dispatch<React.SetStateAction<{ widthPx: number; heightPx: number }>>;
}

// =============================================================================
// Computed Registry State
// =============================================================================

interface CanvasTourRegistryComputedState {
	showRegistryControls: boolean;
	selectedRegistryChapter: CanvasTourChapter;
	selectedRegisteredScene: RegisteredTourSceneSnapshot | null;
}

// =============================================================================
// Complete Page State (maintains backward compatibility)
// =============================================================================

export interface CanvasTourPageState
	extends CanvasTourCoreRefs,
		CanvasTourNavigationState,
		CanvasTourRegistryState,
		CanvasTourOverlayMeasurementState,
		CanvasTourOverlayPlacementState,
		CanvasTourRegistryComputedState,
		CanvasTourNavigationActions,
		CanvasTourRegistryActions,
		CanvasTourOverlayPlacementActions {}
