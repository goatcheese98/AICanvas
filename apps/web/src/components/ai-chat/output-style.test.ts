import { describe, expect, it } from 'vitest';
import { outputStyleToModeHint } from './output-style';

describe('assistant output style', () => {
	it('maps ui output styles to assistant mode hints', () => {
		expect(outputStyleToModeHint('auto')).toBeUndefined();
		expect(outputStyleToModeHint('raster')).toBe('image');
		expect(outputStyleToModeHint('vector-sketch')).toBe('sketch');
		expect(outputStyleToModeHint('svg')).toBe('svg');
	});
});
