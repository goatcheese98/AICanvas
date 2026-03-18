import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BLOCK_SPACING,
	CELL_PADDING,
	CHECKBOX_SIZE,
	COMPACT_SPACING,
	HEADING_STYLES,
	INLINE_RADIUS,
	RENDERER_SURFACE,
	SURFACE_RADIUS,
	failedImageSrcCache,
	getCheckboxLineIndex,
	hasImageFailed,
	markImageAsFailed,
	normalizeDisplayMath,
	subscribeToFailedImageCache,
} from './markdown-renderer-utils';

describe('markdown-renderer-utils', () => {
	describe('constants', () => {
		it('exports styling constants', () => {
			expect(RENDERER_SURFACE).toBe('border border-stone-200');
			expect(SURFACE_RADIUS).toBe('0.7em');
			expect(INLINE_RADIUS).toBe('0.42em');
			expect(BLOCK_SPACING).toBe('0.95em');
			expect(COMPACT_SPACING).toBe('0.55em');
			expect(CELL_PADDING).toBe('0.7em 0.95em');
			expect(CHECKBOX_SIZE).toBe('1.05em');
		});

		it('exports heading styles for all levels', () => {
			expect(HEADING_STYLES.h1.fontSize).toBe('2em');
			expect(HEADING_STYLES.h2.fontSize).toBe('1.6em');
			expect(HEADING_STYLES.h3.fontSize).toBe('1.35em');
			expect(HEADING_STYLES.h4.fontSize).toBe('1.15em');
			expect(HEADING_STYLES.h5.fontSize).toBe('1em');
			expect(HEADING_STYLES.h6.fontSize).toBe('0.92em');
		});
	});

	describe('normalizeDisplayMath', () => {
		it('returns single-line equations unchanged', () => {
			const input = '$$e^{i\\pi} + 1 = 0$$';
			expect(normalizeDisplayMath(input)).toBe(input);
		});

		it('normalizes multiline display math', () => {
			const input = `$$\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}$$`;
			const result = normalizeDisplayMath(input);
			expect(result).toContain('$$\n\\begin{pmatrix}');
			expect(result).toContain('\\end{pmatrix}\n$$');
		});

		it('handles multiple math blocks', () => {
			const input = `$$\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}$$

$$e^{i\\pi} + 1 = 0$$`;
			const result = normalizeDisplayMath(input);
			expect(result).toContain('$$\n\\begin{pmatrix}');
			expect(result).toContain('\\end{pmatrix}\n$$');
			expect(result).toContain('$$e^{i\\pi} + 1 = 0$$');
		});

		it('handles empty lines inside math blocks', () => {
			const input = `$$
\\begin{pmatrix}
a & b
\\end{pmatrix}
$$`;
			const result = normalizeDisplayMath(input);
			expect(result).toContain('$$');
			expect(result).toContain('\\begin{pmatrix}');
		});

		it('preserves content outside math blocks', () => {
			const input = `Some text

$$\\alpha$$`;
			const result = normalizeDisplayMath(input);
			expect(result).toContain('Some text');
			expect(result).toContain('$$\\alpha$$');
		});
	});

	describe('getCheckboxLineIndex', () => {
		it('returns line index from node position (0-based)', () => {
			const node = { position: { start: { line: 5 } } };
			expect(getCheckboxLineIndex(node)).toBe(4);
		});

		it('returns 0 for line 1', () => {
			const node = { position: { start: { line: 1 } } };
			expect(getCheckboxLineIndex(node)).toBe(0);
		});

		it('returns -1 for missing position', () => {
			expect(getCheckboxLineIndex({})).toBe(-1);
		});

		it('returns -1 for missing start', () => {
			expect(getCheckboxLineIndex({ position: {} })).toBe(-1);
		});

		it('returns -1 for null line', () => {
			expect(getCheckboxLineIndex({ position: { start: { line: null } } })).toBe(-1);
		});

		it('returns -1 for NaN line', () => {
			expect(getCheckboxLineIndex({ position: { start: { line: Number.NaN } } })).toBe(-1);
		});
	});

	describe('failed image cache', () => {
		beforeEach(() => {
			// Clear the cache before each test
			failedImageSrcCache.clear();
		});

		it('marks images as failed', () => {
			const src = 'https://example.com/broken.png';
			expect(hasImageFailed(src)).toBe(false);
			markImageAsFailed(src);
			expect(hasImageFailed(src)).toBe(true);
		});

		it('tracks multiple failed images independently', () => {
			const src1 = 'https://example.com/broken1.png';
			const src2 = 'https://example.com/broken2.png';
			markImageAsFailed(src1);
			expect(hasImageFailed(src1)).toBe(true);
			expect(hasImageFailed(src2)).toBe(false);
		});

		it('notifies subscribers when an image fails', () => {
			const src = 'https://example.com/broken.png';
			const callback = vi.fn();
			const unsubscribe = subscribeToFailedImageCache(src, callback);
			markImageAsFailed(src);
			expect(callback).toHaveBeenCalledTimes(1);
			unsubscribe();
		});

		it('only notifies subscribers for their specific src', () => {
			const src1 = 'https://example.com/broken1.png';
			const src2 = 'https://example.com/broken2.png';
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			subscribeToFailedImageCache(src1, callback1);
			subscribeToFailedImageCache(src2, callback2);
			markImageAsFailed(src1);
			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).not.toHaveBeenCalled();
		});

		it('supports multiple subscribers for the same src', () => {
			const src = 'https://example.com/broken.png';
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			subscribeToFailedImageCache(src, callback1);
			subscribeToFailedImageCache(src, callback2);
			markImageAsFailed(src);
			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});

		it('allows unsubscribing from cache updates', () => {
			const src = 'https://example.com/broken.png';
			const callback = vi.fn();
			const unsubscribe = subscribeToFailedImageCache(src, callback);
			unsubscribe();
			markImageAsFailed(src);
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
