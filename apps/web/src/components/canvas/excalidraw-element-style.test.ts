import { describe, expect, it } from 'vitest';
import { getExcalidrawSurfaceStyle } from './excalidraw-element-style';

describe('getExcalidrawSurfaceStyle', () => {
	it('uses an opaque base for hachure fills so the canvas fill does not bleed through', () => {
		const style = getExcalidrawSurfaceStyle({
			backgroundColor: '#cfe8ff',
			fillStyle: 'hachure',
			strokeWidth: 3,
		});

		expect(style.backgroundColor).toMatch(/^rgba\(/);
		expect(style.backgroundImage).not.toContain('transparent');
	});

	it('keeps cross-hatch as a two-layer pattern with a shared opaque base', () => {
		const style = getExcalidrawSurfaceStyle({
			backgroundColor: '#cfe8ff',
			fillStyle: 'cross-hatch',
			strokeWidth: 3,
		});

		expect(style.backgroundColor).toMatch(/^rgba\(/);
		expect(String(style.backgroundImage).match(/repeating-linear-gradient/g)).toHaveLength(2);
	});
});
