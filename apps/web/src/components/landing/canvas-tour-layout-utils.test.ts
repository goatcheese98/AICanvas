import { describe, expect, it } from 'vitest';
import {
	formatCameraCoordinates,
	formatDimensions,
	formatPreviewShift,
	formatZoom,
	formatCapturedTime,
	getSavedZoomLabel,
} from './canvas-tour-layout-utils';

describe('canvas-tour-layout-utils', () => {
	describe('formatZoom', () => {
		it('should format zoom with 2 decimal places', () => {
			expect(formatZoom(1.5)).toBe('1.50x');
			expect(formatZoom(2)).toBe('2.00x');
			expect(formatZoom(0.75)).toBe('0.75x');
		});
	});

	describe('formatCameraCoordinates', () => {
		it('should format coordinates with rounded values', () => {
			expect(formatCameraCoordinates(100.5, 200.7)).toBe('101, 201');
			expect(formatCameraCoordinates(0, 0)).toBe('0, 0');
			expect(formatCameraCoordinates(-50.2, 150.8)).toBe('-50, 151');
		});
	});

	describe('formatDimensions', () => {
		it('should format dimensions with 1 decimal place', () => {
			expect(formatDimensions(10, 20)).toBe('10.0rem x 20.0rem');
			expect(formatDimensions(10.5, 20.75)).toBe('10.5rem x 20.8rem');
		});
	});

	describe('formatCapturedTime', () => {
		it('should return "Not saved" for null timestamp', () => {
			expect(formatCapturedTime(null)).toBe('Not saved');
		});

		it('should format valid timestamp to locale time string', () => {
			const timestamp = new Date('2024-01-15T10:30:00').getTime();
			const result = formatCapturedTime(timestamp);
			// Should return a time string (format depends on locale)
			expect(result).not.toBe('Not saved');
			expect(typeof result).toBe('string');
		});
	});

	describe('getSavedZoomLabel', () => {
		it('should return "Default" for null scene', () => {
			expect(getSavedZoomLabel(null)).toBe('Default');
		});

		it('should format zoom from scene camera', () => {
			const scene = {
				id: 'test',
				chapterId: 'chapter1',
				capturedAt: Date.now(),
				camera: { x: 0, y: 0, zoom: 1.5 },
				elements: [],
			};
			expect(getSavedZoomLabel(scene as any)).toBe('1.50x');
		});
	});

	describe('formatPreviewShift', () => {
		it('should return "None" when panel is not aware', () => {
			expect(formatPreviewShift(false, 1, 2)).toBe('None');
		});

		it('should format shift values when panel is aware', () => {
			expect(formatPreviewShift(true, 1.5, 2.5)).toBe('1.5rem, 2.5rem');
			expect(formatPreviewShift(true, 0, 0)).toBe('0.0rem, 0.0rem');
		});
	});
});
