import type { CanvasTourChapter, CanvasTourGuideOverlay } from './canvas-tour-content';
import type { CameraTarget } from './useCanvasTourSceneController';

export type OverlayPlacementPreset = 'top-left' | 'top-center' | 'top-right' | 'bottom-left';

export type OverlayPlacementBounds = {
	leftMinRem: number;
	leftMaxRem: number;
	topMinRem: number;
	topMaxRem: number;
	widthMinRem: number;
	widthMaxRem: number;
};

export type OverlaySafeArea = {
	leftPx: number;
	topPx: number;
	rightPx: number;
	bottomPx: number;
	widthPx: number;
	heightPx: number;
};

export const OVERLAY_LEFT_MARGIN_REM = 1.2;
export const OVERLAY_TOP_MARGIN_REM = 1.2;
const OVERLAY_RIGHT_MARGIN_REM = 1.2;
const OVERLAY_BOTTOM_MARGIN_REM = 1.2;
export const OVERLAY_MIN_WIDTH_REM = 11;
export const OVERLAY_DEFAULT_HEIGHT_REM = 22;
export const OVERLAY_MAX_WIDTH_REM = 26;

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function getChapterById(
	sceneId: string,
	fallback: CanvasTourChapter,
	chapters: readonly CanvasTourChapter[],
): CanvasTourChapter {
	return chapters.find((chapter) => chapter.id === sceneId) ?? fallback;
}

export function buildSafeArea(
	reserveLayoutPanel: boolean,
	stageViewportSize: { widthPx: number; heightPx: number },
	layoutPanelWidthPx: number,
	rootFontSizePx: number,
): OverlaySafeArea {
	const leftPx = OVERLAY_LEFT_MARGIN_REM * rootFontSizePx;
	const topPx = OVERLAY_TOP_MARGIN_REM * rootFontSizePx;
	const rightInsetPx =
		(reserveLayoutPanel ? layoutPanelWidthPx + 20 : 0) + OVERLAY_RIGHT_MARGIN_REM * rootFontSizePx;
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
}

export function buildOverlayPlacementBounds(
	guideSafeArea: OverlaySafeArea,
	rootFontSizePx: number,
): OverlayPlacementBounds {
	return {
		leftMinRem: OVERLAY_LEFT_MARGIN_REM,
		leftMaxRem: Math.max(
			OVERLAY_LEFT_MARGIN_REM,
			(guideSafeArea.rightPx - OVERLAY_MIN_WIDTH_REM * rootFontSizePx) / rootFontSizePx,
		),
		topMinRem: OVERLAY_TOP_MARGIN_REM,
		topMaxRem: Math.max(
			OVERLAY_TOP_MARGIN_REM,
			(guideSafeArea.bottomPx - OVERLAY_DEFAULT_HEIGHT_REM * rootFontSizePx) / rootFontSizePx,
		),
		widthMinRem: OVERLAY_MIN_WIDTH_REM,
		widthMaxRem: Math.max(
			OVERLAY_MIN_WIDTH_REM,
			Math.min(OVERLAY_MAX_WIDTH_REM, guideSafeArea.widthPx / rootFontSizePx),
		),
	};
}

export function clampOverlayPlacement(
	placement: CanvasTourGuideOverlay['placement'],
	area: OverlaySafeArea,
	overlayHeightPx: number,
	rootFontSizePx: number,
): CanvasTourGuideOverlay['placement'] {
	const widthRem = clamp(
		placement.widthRem,
		OVERLAY_MIN_WIDTH_REM,
		Math.max(OVERLAY_MIN_WIDTH_REM, Math.min(OVERLAY_MAX_WIDTH_REM, area.widthPx / rootFontSizePx)),
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
}

export function calculateOverlayPreset(
	preset: OverlayPlacementPreset,
	guideSafeArea: OverlaySafeArea,
	overlayHeightPx: number,
	rootFontSizePx: number,
	bounds: OverlayPlacementBounds,
): CanvasTourGuideOverlay['placement'] {
	const targetWidthRem =
		preset === 'top-center'
			? clamp(17, bounds.widthMinRem, bounds.widthMaxRem)
			: clamp(16, bounds.widthMinRem, bounds.widthMaxRem);
	const targetWidthPx = targetWidthRem * rootFontSizePx;
	const leftEdgeRem = guideSafeArea.leftPx / rootFontSizePx;
	const rightEdgeRem = Math.max(
		OVERLAY_LEFT_MARGIN_REM,
		(guideSafeArea.rightPx - targetWidthPx) / rootFontSizePx,
	);
	const centeredLeftRem = clamp(
		(guideSafeArea.leftPx + (guideSafeArea.widthPx - targetWidthPx) / 2) / rootFontSizePx,
		bounds.leftMinRem,
		bounds.leftMaxRem,
	);
	const topEdgeRem = guideSafeArea.topPx / rootFontSizePx;
	const bottomEdgeRem = Math.max(
		OVERLAY_TOP_MARGIN_REM,
		(guideSafeArea.bottomPx - overlayHeightPx) / rootFontSizePx,
	);

	if (preset === 'top-left') {
		return { leftRem: leftEdgeRem, topRem: topEdgeRem, widthRem: targetWidthRem };
	}
	if (preset === 'top-center') {
		return { leftRem: centeredLeftRem, topRem: topEdgeRem, widthRem: targetWidthRem };
	}
	if (preset === 'top-right') {
		return { leftRem: rightEdgeRem, topRem: topEdgeRem, widthRem: targetWidthRem };
	}
	return { leftRem: leftEdgeRem, topRem: bottomEdgeRem, widthRem: targetWidthRem };
}

export function getRootFontSizePx(): number {
	if (typeof window === 'undefined') return 16;
	return Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
}

function createCameraFromAppState(
	appState: Partial<{
		zoom?: { value?: number };
		width?: number;
		height?: number;
		scrollX?: number;
		scrollY?: number;
	}>,
	viewportSize: { width: number; height: number },
): CameraTarget {
	const zoom =
		typeof appState.zoom?.value === 'number' && appState.zoom.value > 0 ? appState.zoom.value : 1;
	const width =
		typeof appState.width === 'number' && appState.width > 0 ? appState.width : viewportSize.width;
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
}
