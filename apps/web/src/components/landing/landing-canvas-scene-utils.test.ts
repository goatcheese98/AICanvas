import { describe, expect, it } from 'vitest';
import { BoardLogo, ToolbarIcon } from './landing-canvas-scene-utils';

describe('landing-canvas-scene-utils', () => {
	describe('BoardLogo', () => {
		it('should export BoardLogo function', () => {
			expect(typeof BoardLogo).toBe('function');
		});
	});

	describe('ToolbarIcon', () => {
		it('should export ToolbarIcon function', () => {
			expect(typeof ToolbarIcon).toBe('function');
		});
	});
});
