import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { normalizeAiVectorGroupResize } from './ai-vector-resize-normalizer';

function createLineElement(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
	points: Array<readonly [number, number]>,
): ExcalidrawElement {
	return {
		id,
		type: 'line',
		x,
		y,
		width,
		height,
		angle: 0,
		strokeColor: '#444444',
		backgroundColor: 'transparent',
		fillStyle: 'solid',
		strokeWidth: 2,
		strokeStyle: 'solid',
		roughness: 0,
		opacity: 100,
		groupIds: ['vector-group-1'],
		frameId: null,
		roundness: null,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		seed: 1,
		index: 'a0' as never,
		points,
		lastCommittedPoint: points[points.length - 1] ?? null,
		customData: {
			type: 'ai-generated-vector-elements',
		},
	} as unknown as ExcalidrawElement;
}

describe('normalizeAiVectorGroupResize', () => {
	it('preserves the previous aspect ratio for selected ai vector groups', () => {
		const previousElements = [
			createLineElement('line-1', 10, 10, 20, 100, [
				[0, 0],
				[20, 100],
			]),
			createLineElement('line-2', 40, 10, 20, 100, [
				[0, 100],
				[20, 0],
			]),
		];
		const nextElements = [
			createLineElement('line-1', 10, 10, 220, 100, [
				[0, 0],
				[220, 100],
			]),
			createLineElement('line-2', 240, 10, 220, 100, [
				[0, 100],
				[220, 0],
			]),
		];

		const normalized = normalizeAiVectorGroupResize({
			previousElements,
			nextElements,
			selectedElementIds: {
				'line-1': true,
				'line-2': true,
			},
		});

		expect(normalized).not.toBeNull();
		const result = normalized ?? [];
		const left = Math.min(...result.map((element) => element.x));
		const top = Math.min(...result.map((element) => element.y));
		const right = Math.max(...result.map((element) => element.x + Math.abs(element.width)));
		const bottom = Math.max(...result.map((element) => element.y + Math.abs(element.height)));
		const aspectRatio = (right - left) / (bottom - top);

		expect(aspectRatio).toBeCloseTo(0.5, 1);
		expect(result[0].width).toBeLessThan(nextElements[0].width);
		expect(
			(result[0] as unknown as { points: Array<readonly [number, number]> }).points[1][0],
		).toBeLessThan(nextElements[0].width);
	});
});
