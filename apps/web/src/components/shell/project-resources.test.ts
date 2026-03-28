import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { buildCanvasProjectResources, getActiveProjectResourceName } from './project-resources';
import type { ProjectResource } from './types';

function createSceneElement(
	id: string,
	customData: Record<string, unknown>,
	options?: { isDeleted?: boolean },
) {
	return {
		id,
		type: 'rectangle',
		isDeleted: options?.isDeleted ?? false,
		customData,
	} as unknown as ExcalidrawElement;
}

describe('buildCanvasProjectResources', () => {
	it('creates a canvas resource and appends live prototype resources', () => {
		const resources = buildCanvasProjectResources({
			canvasId: 'canvas-1',
			canvasTitle: ' Product Strategy ',
			elements: [
				createSceneElement('note-1', { type: 'markdown', title: 'Ignored note' }),
				createSceneElement('prototype-1', { type: 'prototype', title: 'Landing Page' }),
				createSceneElement('prototype-2', { type: 'prototype', title: '  ' }),
				createSceneElement(
					'prototype-3',
					{ type: 'prototype', title: 'Deleted prototype' },
					{ isDeleted: true },
				),
			],
		});

		expect(resources).toEqual([
			{ id: 'canvas-1', type: 'canvas', name: 'Product Strategy' },
			{ id: 'prototype-1', type: 'prototype', name: 'Landing Page' },
			{ id: 'prototype-2', type: 'prototype', name: 'Prototype' },
		]);
	});

	it('falls back to stable labels when names are missing', () => {
		const resources = buildCanvasProjectResources({
			canvasId: 'canvas-1',
			canvasTitle: '   ',
			elements: [],
		});

		expect(resources).toEqual([{ id: 'canvas-1', type: 'canvas', name: 'Overview Canvas' }]);
	});
});

describe('getActiveProjectResourceName', () => {
	it('returns the active resource name or a fallback', () => {
		const resources: ProjectResource[] = [
			{ id: 'canvas-1', type: 'canvas', name: 'Overview Canvas' },
			{ id: 'prototype-1', type: 'prototype', name: 'Landing Page' },
		];

		expect(getActiveProjectResourceName(resources, 'prototype-1', 'Canvas')).toBe('Landing Page');
		expect(getActiveProjectResourceName(resources, 'missing', 'Canvas')).toBe('Canvas');
	});
});
