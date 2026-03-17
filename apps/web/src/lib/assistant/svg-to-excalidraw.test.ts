import { describe, expect, it, vi } from 'vitest';

vi.mock('@excalidraw/excalidraw', () => {
	return {
		convertToExcalidrawElements: vi.fn((elements: unknown[]) =>
			elements.map((element, index) => ({
				id: `compiled-${index + 1}`,
				angle: 0,
				seed: 1 + index,
				version: 1,
				versionNonce: 100 + index,
				index: `a${index}` as never,
				isDeleted: false,
				groupIds: [],
				frameId: null,
				boundElements: null,
				updated: 1,
				link: null,
				locked: false,
				width: 0,
				height: 0,
				...(element as Record<string, unknown>),
			})),
		),
	};
});

import { compileSvgToExcalidraw } from './svg-to-excalidraw';

describe('compileSvgToExcalidraw', () => {
	it('compiles filled paths into native line elements with fill and stroke', () => {
		const result = compileSvgToExcalidraw(
			[
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
				'  <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill="#f59e0b" stroke="#111827" stroke-width="4" />',
				'</svg>',
			].join(''),
		);

		expect(result.width).toBe(160);
		expect(result.height).toBe(160);
		expect(result.elements).toHaveLength(1);
		expect(result.elements[0]).toMatchObject({
			type: 'line',
			backgroundColor: '#f59e0b',
			strokeColor: '#111827',
			strokeWidth: 4,
			fillStyle: 'solid',
			customData: expect.objectContaining({
				type: 'ai-generated-vector-elements',
			}),
		});
		expect(
			(result.elements[0] as unknown as { points: unknown[] }).points.length,
		).toBeGreaterThanOrEqual(4);
	});

	it('compiles basic SVG primitives into native Excalidraw shapes', () => {
		const result = compileSvgToExcalidraw(
			[
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">',
				'  <rect x="10" y="20" width="80" height="40" rx="12" fill="#dbeafe" stroke="#1d4ed8" stroke-width="3" />',
				'  <ellipse cx="170" cy="60" rx="40" ry="24" fill="#dcfce7" stroke="#166534" stroke-width="2" />',
				'</svg>',
			].join(''),
		);

		expect(result.elements).toHaveLength(2);
		expect(result.elements[0]).toMatchObject({
			type: 'rectangle',
			backgroundColor: '#dbeafe',
			strokeColor: '#1d4ed8',
		});
		expect(result.elements[1]).toMatchObject({
			type: 'ellipse',
			backgroundColor: '#dcfce7',
			strokeColor: '#166534',
		});
	});

	it('keeps traced fill loops visible when the svg path has no explicit stroke', () => {
		const result = compileSvgToExcalidraw(
			[
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
				'  <path d="M 20 20 L 80 20 L 70 80 L 30 80 Z" fill="#a16207" stroke="transparent" />',
				'</svg>',
			].join(''),
			{ maxPointsPerElement: 12 },
		);

		expect(result.elements).toHaveLength(1);
		expect(result.elements[0]).toMatchObject({
			type: 'line',
			backgroundColor: '#a16207',
			strokeColor: '#a16207',
			strokeWidth: 1,
		});
		expect(
			(result.elements[0] as unknown as { points: unknown[] }).points.length,
		).toBeLessThanOrEqual(12);
	});
});
