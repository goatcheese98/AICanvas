import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { buildProjectResources } from './project-resource-utils';

function createElement(
	id: string,
	title: string,
	type: 'kanban' | 'markdown' = 'kanban',
): ExcalidrawElement {
	return {
		id,
		index: 'a0',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 320,
		height: 240,
		angle: 0,
		backgroundColor: '#ffffff',
		strokeColor: '#111111',
		strokeWidth: 1,
		strokeStyle: 'solid',
		roughness: 0,
		opacity: 100,
		fillStyle: 'solid',
		roundness: null,
		groupIds: [],
		frameId: null,
		boundElements: null,
		updated: 1,
		link: null,
		seed: 1,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		locked: false,
		customData: { type, title },
	} as unknown as ExcalidrawElement;
}

function createDeletedElement(id: string, title: string): ExcalidrawElement {
	return {
		...createElement(id, title),
		isDeleted: true,
	} as unknown as ExcalidrawElement;
}

describe('buildProjectResources', () => {
	it('includes the canvas and kanban board resources', () => {
		const resources = buildProjectResources({
			canvasId: 'canvas-1',
			canvasName: 'Launch Canvas',
			elements: [createElement('board-1', 'Launch Board')],
		});

		expect(resources).toEqual([
			{ id: 'canvas-1', type: 'canvas', name: 'Launch Canvas' },
			{ id: 'board-1', type: 'board', name: 'Launch Board' },
		]);
	});

	it('ignores non-kanban elements', () => {
		const resources = buildProjectResources({
			canvasId: 'canvas-1',
			canvasName: 'Launch Canvas',
			elements: [createElement('note-1', 'Note', 'markdown')],
		});

		expect(resources).toEqual([{ id: 'canvas-1', type: 'canvas', name: 'Launch Canvas' }]);
	});

	it('ignores deleted kanban elements', () => {
		const resources = buildProjectResources({
			canvasId: 'canvas-1',
			canvasName: 'Launch Canvas',
			elements: [createDeletedElement('board-deleted', 'Deleted Board')],
		});

		expect(resources).toEqual([{ id: 'canvas-1', type: 'canvas', name: 'Launch Canvas' }]);
	});

	it('prefers resource snapshot titles when available', () => {
		const resources = buildProjectResources({
			canvasId: 'canvas-1',
			canvasName: 'Launch Canvas',
			elements: [
				{
					...createElement('board-1', 'Fallback Title'),
					customData: {
						type: 'kanban',
						title: 'Fallback Title',
						resourceSnapshot: {
							resourceType: 'board',
							resourceId: 'board-1',
							title: 'Snapshot Title',
							snapshotVersion: 1,
							display: {},
						},
					},
				},
			],
		});

		expect(resources).toEqual([
			{ id: 'canvas-1', type: 'canvas', name: 'Launch Canvas' },
			{ id: 'board-1', type: 'board', name: 'Snapshot Title' },
		]);
	});
});
