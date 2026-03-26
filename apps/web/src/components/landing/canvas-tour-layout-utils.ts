import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import type { RegisteredTourSceneSnapshot } from './canvas-tour-registry';
import type { CameraTarget } from './useCanvasTourSceneController';

/**
 * Props for the CanvasTourLayoutPanel component.
 */
export interface CanvasTourLayoutPanelProps {
	canvasTourChapters: readonly CanvasTourChapter[];
	devCaptureStatus: string | null;
	liveCamera: CameraTarget;
	overlayDraft: CanvasTourGuideOverlay;
	overlayPlacementBounds: {
		leftMinRem: number;
		leftMaxRem: number;
		topMinRem: number;
		topMaxRem: number;
		widthMinRem: number;
		widthMaxRem: number;
	};
	overlayPlacementMeta: {
		guideWidthRem: number;
		guideHeightRem: number;
		editorWidthRem: number;
		editorHeightRem: number;
		panelAwarePreview: boolean;
		previewShiftXRem: number;
		previewShiftYRem: number;
	};
	registryCaptureMode: 'full' | 'camera' | 'elements';
	registrySceneId: string;
	selectedRegisteredScene: RegisteredTourSceneSnapshot | null;
	selectedRegistryChapter: CanvasTourChapter;
	setRegistryCaptureMode: (mode: 'full' | 'camera' | 'elements') => void;
	setRegistrySceneId: (sceneId: string) => void;
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
	applyOverlayPreset: (preset: 'top-left' | 'top-center' | 'top-right' | 'bottom-left') => void;
	applyOverlayDraft: () => void;
	saveOverlayDraft: () => void;
	registerCurrentLayout: () => void;
	restoreRegisteredLayout: () => void;
	copyRegisteredLayout: () => void;
	clearRegisteredLayout: () => void;
}

/**
 * Props for the header section.
 */
export interface LayoutPanelHeaderProps {
	kicker?: string;
	copy: string;
}

/**
 * Props for the scene selector section.
 */
export interface SceneSelectorProps {
	registrySceneId: string;
	canvasTourChapters: readonly CanvasTourChapter[];
	liveCamera: CameraTarget;
	selectedRegisteredScene: RegisteredTourSceneSnapshot | null;
	setRegistrySceneId: (sceneId: string) => void;
}

/**
 * Props for the capture scope toggle.
 */
export interface CaptureScopeToggleProps {
	registryCaptureMode: 'full' | 'camera' | 'elements';
	setRegistryCaptureMode: (mode: 'full' | 'camera' | 'elements') => void;
}

/**
 * Props for the overlay editor section.
 */
export interface OverlayEditorProps {
	overlayDraft: CanvasTourGuideOverlay;
	overlayPlacementBounds: CanvasTourLayoutPanelProps['overlayPlacementBounds'];
	overlayPlacementMeta: CanvasTourLayoutPanelProps['overlayPlacementMeta'];
	updateOverlayDraft: CanvasTourLayoutPanelProps['updateOverlayDraft'];
	updateOverlayPlacement: CanvasTourLayoutPanelProps['updateOverlayPlacement'];
	nudgeOverlayPlacement: CanvasTourLayoutPanelProps['nudgeOverlayPlacement'];
	applyOverlayPreset: CanvasTourLayoutPanelProps['applyOverlayPreset'];
	applyOverlayDraft: () => void;
	saveOverlayDraft: () => void;
}

/**
 * Props for the scene actions section.
 */
export interface SceneActionsProps {
	selectedRegistryChapter: CanvasTourChapter;
	registerCurrentLayout: () => void;
	restoreRegisteredLayout: () => void;
	copyRegisteredLayout: () => void;
	clearRegisteredLayout: () => void;
}

/**
 * Props for the status indicator.
 */
export interface CaptureStatusProps {
	devCaptureStatus: string | null;
}

/**
 * Format zoom level with fixed decimal places.
 */
export function formatZoom(zoom: number): string {
	return `${zoom.toFixed(2)}x`;
}

/**
 * Format camera coordinates as a string.
 */
export function formatCameraCoordinates(x: number, y: number): string {
	return `${Math.round(x)}, ${Math.round(y)}`;
}

/**
 * Format dimensions as a string with rem units.
 */
export function formatDimensions(width: number, height: number): string {
	return `${width.toFixed(1)}rem x ${height.toFixed(1)}rem`;
}

/**
 * Format a date timestamp to a locale time string.
 */
export function formatCapturedTime(timestamp: number | string | null): string {
	if (!timestamp) return 'Not saved';
	return new Date(timestamp).toLocaleTimeString();
}

/**
 * Get display label for saved zoom.
 */
export function getSavedZoomLabel(scene: RegisteredTourSceneSnapshot | null): string {
	if (!scene) return 'Default';
	return formatZoom(scene.camera.zoom);
}

/**
 * Format preview shift for display.
 */
export function formatPreviewShift(panelAware: boolean, x: number, y: number): string {
	if (!panelAware) return 'None';
	return `${x.toFixed(1)}rem, ${y.toFixed(1)}rem`;
}
