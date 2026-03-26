import { describe, expect, it } from 'vitest';
import { canvasTourChapters } from './canvas-tour-content';
import {
	OVERLAY_DEFAULT_HEIGHT_REM,
	OVERLAY_LEFT_MARGIN_REM,
	OVERLAY_MAX_WIDTH_REM,
	OVERLAY_MIN_WIDTH_REM,
	OVERLAY_TOP_MARGIN_REM,
	buildOverlayPlacementBounds,
	buildSafeArea,
	calculateOverlayPreset,
	clamp,
	clampOverlayPlacement,
	getChapterById,
} from './canvas-tour-page-utils';

describe('canvas-tour-page-utils', () => {
	describe('clamp', () => {
		it('returns value when within bounds', () => {
			expect(clamp(5, 0, 10)).toBe(5);
		});

		it('returns min when value is below bounds', () => {
			expect(clamp(-5, 0, 10)).toBe(0);
		});

		it('returns max when value is above bounds', () => {
			expect(clamp(15, 0, 10)).toBe(10);
		});

		it('handles equal min and max', () => {
			expect(clamp(5, 3, 3)).toBe(3);
		});
	});

	describe('getChapterById', () => {
		it('returns chapter when found', () => {
			const fallback = canvasTourChapters[0];
			const found = getChapterById('llm-midterm', fallback, canvasTourChapters);
			expect(found.id).toBe('llm-midterm');
		});

		it('returns fallback when not found', () => {
			const fallback = canvasTourChapters[0];
			const found = getChapterById('non-existent', fallback, canvasTourChapters);
			expect(found).toBe(fallback);
		});
	});

	describe('buildSafeArea', () => {
		const viewportSize = { widthPx: 1000, heightPx: 800 };
		const layoutPanelWidthPx = 300;
		const rootFontSizePx = 16;

		it('builds safe area without layout panel', () => {
			const area = buildSafeArea(false, viewportSize, layoutPanelWidthPx, rootFontSizePx);

			expect(area.leftPx).toBe(OVERLAY_LEFT_MARGIN_REM * rootFontSizePx);
			expect(area.topPx).toBe(OVERLAY_TOP_MARGIN_REM * rootFontSizePx);
			expect(area.widthPx).toBeGreaterThan(0);
			expect(area.heightPx).toBeGreaterThan(0);
		});

		it('builds safe area with layout panel', () => {
			const area = buildSafeArea(true, viewportSize, layoutPanelWidthPx, rootFontSizePx);

			expect(area.leftPx).toBe(OVERLAY_LEFT_MARGIN_REM * rootFontSizePx);
			expect(area.topPx).toBe(OVERLAY_TOP_MARGIN_REM * rootFontSizePx);
			// Right edge should account for layout panel
			expect(area.rightPx).toBeLessThan(viewportSize.widthPx);
		});

		it('ensures minimum safe area dimensions', () => {
			const smallViewport = { widthPx: 200, heightPx: 200 };
			const area = buildSafeArea(false, smallViewport, 0, rootFontSizePx);

			expect(area.widthPx).toBeGreaterThanOrEqual(0);
			expect(area.heightPx).toBeGreaterThanOrEqual(0);
		});
	});

	describe('buildOverlayPlacementBounds', () => {
		const rootFontSizePx = 16;
		const guideSafeArea = {
			leftPx: 20,
			topPx: 20,
			rightPx: 980,
			bottomPx: 780,
			widthPx: 960,
			heightPx: 760,
		};

		it('calculates bounds based on safe area', () => {
			const bounds = buildOverlayPlacementBounds(guideSafeArea, rootFontSizePx);

			expect(bounds.leftMinRem).toBe(OVERLAY_LEFT_MARGIN_REM);
			expect(bounds.topMinRem).toBe(OVERLAY_TOP_MARGIN_REM);
			expect(bounds.widthMinRem).toBe(OVERLAY_MIN_WIDTH_REM);
			expect(bounds.widthMaxRem).toBeLessThanOrEqual(OVERLAY_MAX_WIDTH_REM);
		});
	});

	describe('clampOverlayPlacement', () => {
		const rootFontSizePx = 16;
		const overlayHeightPx = OVERLAY_DEFAULT_HEIGHT_REM * rootFontSizePx;
		const area = {
			leftPx: 20,
			topPx: 20,
			rightPx: 500,
			bottomPx: 400,
			widthPx: 480,
			heightPx: 380,
		};

		it('clamps placement within safe area', () => {
			const placement = { leftRem: 1, topRem: 1, widthRem: 20 };
			const clamped = clampOverlayPlacement(placement, area, overlayHeightPx, rootFontSizePx);

			expect(clamped.leftRem).toBeGreaterThanOrEqual(OVERLAY_LEFT_MARGIN_REM);
			expect(clamped.topRem).toBeGreaterThanOrEqual(OVERLAY_TOP_MARGIN_REM);
			expect(clamped.widthRem).toBeGreaterThanOrEqual(OVERLAY_MIN_WIDTH_REM);
		});

		it('clamps width to max allowed', () => {
			const placement = { leftRem: 2, topRem: 2, widthRem: 50 };
			const clamped = clampOverlayPlacement(placement, area, overlayHeightPx, rootFontSizePx);

			expect(clamped.widthRem).toBeLessThanOrEqual(
				Math.max(
					OVERLAY_MIN_WIDTH_REM,
					Math.min(OVERLAY_MAX_WIDTH_REM, area.widthPx / rootFontSizePx),
				),
			);
		});
	});

	describe('calculateOverlayPreset', () => {
		const rootFontSizePx = 16;
		const overlayHeightPx = OVERLAY_DEFAULT_HEIGHT_REM * rootFontSizePx;
		const guideSafeArea = {
			leftPx: 20,
			topPx: 20,
			rightPx: 980,
			bottomPx: 780,
			widthPx: 960,
			heightPx: 760,
		};
		const bounds = {
			leftMinRem: OVERLAY_LEFT_MARGIN_REM,
			leftMaxRem: 50,
			topMinRem: OVERLAY_TOP_MARGIN_REM,
			topMaxRem: 40,
			widthMinRem: OVERLAY_MIN_WIDTH_REM,
			widthMaxRem: OVERLAY_MAX_WIDTH_REM,
		};

		it('calculates top-left preset', () => {
			const preset = calculateOverlayPreset(
				'top-left',
				guideSafeArea,
				overlayHeightPx,
				rootFontSizePx,
				bounds,
			);

			expect(preset.leftRem).toBeGreaterThanOrEqual(bounds.leftMinRem);
			expect(preset.topRem).toBeGreaterThanOrEqual(bounds.topMinRem);
		});

		it('calculates top-center preset', () => {
			const preset = calculateOverlayPreset(
				'top-center',
				guideSafeArea,
				overlayHeightPx,
				rootFontSizePx,
				bounds,
			);

			expect(preset.leftRem).toBeGreaterThanOrEqual(bounds.leftMinRem);
			expect(preset.topRem).toBeGreaterThanOrEqual(bounds.topMinRem);
			// Top-center should use 17rem width
			expect(preset.widthRem).toBeGreaterThanOrEqual(bounds.widthMinRem);
		});

		it('calculates top-right preset', () => {
			const preset = calculateOverlayPreset(
				'top-right',
				guideSafeArea,
				overlayHeightPx,
				rootFontSizePx,
				bounds,
			);

			expect(preset.leftRem).toBeGreaterThanOrEqual(bounds.leftMinRem);
			expect(preset.topRem).toBeGreaterThanOrEqual(bounds.topMinRem);
		});

		it('calculates bottom-left preset', () => {
			const preset = calculateOverlayPreset(
				'bottom-left',
				guideSafeArea,
				overlayHeightPx,
				rootFontSizePx,
				bounds,
			);

			expect(preset.leftRem).toBeGreaterThanOrEqual(bounds.leftMinRem);
			expect(preset.topRem).toBeGreaterThan(bounds.topMinRem);
		});
	});
});
