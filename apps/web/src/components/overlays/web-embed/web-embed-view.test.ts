import { describe, expect, it } from 'vitest';
import { clampPipPosition, getDefaultPipPosition, getPipDimensions } from './web-embed-view';

describe('web-embed-view', () => {
	it('sizes pip embeds within min/max bounds', () => {
		expect(getPipDimensions(600)).toEqual({ width: 260, height: 162.5 });
		expect(getPipDimensions(2000)).toEqual({ width: 420, height: 262.5 });
	});

	it('clamps pip positions into the viewport bounds', () => {
		expect(clampPipPosition({ x: -50, y: 10 }, { width: 1200, height: 800 })).toEqual({
			x: 20,
			y: 88,
		});
	});

	it('places the default pip in the top-right corner area', () => {
		expect(getDefaultPipPosition({ width: 1200, height: 800 })).toEqual({
			x: 844,
			y: 88,
		});
	});
});
