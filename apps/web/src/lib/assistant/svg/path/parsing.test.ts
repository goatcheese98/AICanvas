import { describe, expect, it } from 'vitest';
import { parseSvgPathContours, parseSvgPoints } from './parsing';

describe('parsing', () => {
	it('parses svg point lists into point pairs', () => {
		expect(parseSvgPoints('0,0 10,20 30 40 50')).toEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
		]);
	});

	it('builds closed contours from mixed relative line commands', () => {
		const contours = parseSvgPathContours('M 0 0 l 10 0 v 10 h -10 z');

		expect(contours).toHaveLength(1);
		expect(contours[0]?.closed).toBe(true);
		expect(contours[0]?.points[0]).toEqual({ x: 0, y: 0 });
		expect(contours[0]?.points.at(-1)).toEqual({ x: 0, y: 0 });
	});

	it('samples smooth quadratic and cubic path commands', () => {
		const contours = parseSvgPathContours(
			'M 0 0 Q 10 20 20 0 T 40 0 C 45 10 55 10 60 0 S 75 -10 80 0',
			1,
		);

		expect(contours).toHaveLength(1);
		expect(contours[0]?.closed).toBe(false);
		expect((contours[0]?.points.length ?? 0) > 10).toBe(true);
		expect(contours[0]?.points.at(-1)?.x).toBeCloseTo(80, 5);
		expect(contours[0]?.points.at(-1)?.y).toBeCloseTo(0, 5);
	});

	it('samples arc commands and preserves multiple subpaths', () => {
		const contours = parseSvgPathContours('M 0 0 A 10 10 0 0 1 20 0 M 30 0 L 40 0');

		expect(contours).toHaveLength(2);
		expect((contours[0]?.points.length ?? 0) > 2).toBe(true);
		expect(contours[0]?.points.at(-1)?.x).toBeCloseTo(20, 5);
		expect(contours[1]?.points).toEqual([
			{ x: 30, y: 0 },
			{ x: 40, y: 0 },
		]);
	});
});
