import { describe, expect, it } from 'vitest';
import { canvasSchemas, getCanvasTitleKey, normalizeCanvasTitle } from './canvas';

describe('canvas schema helpers', () => {
	it('normalizes canvas titles consistently', () => {
		expect(normalizeCanvasTitle('  Product   Roadmap  ')).toBe('Product Roadmap');
		expect(getCanvasTitleKey('  Product   Roadmap  ')).toBe('product roadmap');
	});

	it('trims and validates create payload titles', () => {
		const parsed = canvasSchemas.create.parse({
			title: '  Design Sprint   Board ',
			description: '  Dashboard-created canvas  ',
			isPublic: false,
		});

		expect(parsed.title).toBe('Design Sprint Board');
		expect(parsed.description).toBe('Dashboard-created canvas');
	});

	it('rejects empty titles after trimming', () => {
		expect(() => canvasSchemas.create.parse({ title: '   ', isPublic: false })).toThrow(
			'Canvas name is required.',
		);
	});
});
