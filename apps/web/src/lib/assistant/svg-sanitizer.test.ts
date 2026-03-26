import { describe, expect, it } from 'vitest';
import { sanitizeSvgMarkup } from './svg-sanitizer';

describe('sanitizeSvgMarkup', () => {
	it('removes executable SVG content while preserving safe markup', () => {
		const sanitized = sanitizeSvgMarkup(
			[
				'<svg xmlns="http://www.w3.org/2000/svg" onclick="alert(1)">',
				'  <script>alert(1)</script>',
				'  <foreignObject><div>bad</div></foreignObject>',
				'  <a href="javascript:alert(1)"><text x="10" y="20">Unsafe link</text></a>',
				'  <rect width="20" height="20" style="fill:red;javascript:alert(1)" />',
				'  <text x="5" y="15">Safe text</text>',
				'</svg>',
			].join(''),
		);

		expect(sanitized).not.toContain('<script');
		expect(sanitized).not.toContain('<foreignObject');
		expect(sanitized).not.toContain('onclick=');
		expect(sanitized).not.toContain('javascript:alert(1)');
		expect(sanitized).toContain('Safe text');
	});
});
