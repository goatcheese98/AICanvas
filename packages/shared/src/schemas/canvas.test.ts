import { describe, expect, it } from 'vitest';
import { canvasSchemas } from './canvas';

describe('canvas schemas', () => {
	it('normalizes overlay custom data inside canvas elements', () => {
		const result = canvasSchemas.data.parse({
			elements: [
				{
					id: 'md-1',
					type: 'rectangle',
					customData: {
						type: 'markdown',
						content: 'Hello',
					},
				},
				{
					id: 'kanban-1',
					type: 'rectangle',
					customData: {
						type: 'kanban',
						title: 'Board',
						columns: [],
					},
				},
				{
					id: 'shape-1',
					type: 'rectangle',
				},
			],
			appState: {},
			files: null,
		});

		expect(result.elements[0]?.customData).toMatchObject({
			type: 'markdown',
			content: 'Hello',
			editorMode: 'raw',
		});
		expect(result.elements[1]?.customData).toMatchObject({
			type: 'kanban',
			title: 'Board',
		});
		// Empty columns preserved for reference-only cards
		expect((result.elements[1]?.customData as { columns: unknown[] }).columns).toHaveLength(0);
		expect(result.elements[2]?.customData).toBeUndefined();
	});

	it('rejects canvas data larger than 10MB', () => {
		const result = canvasSchemas.data.safeParse({
			elements: [],
			appState: {},
			files: {
				oversized: {
					data: 'x'.repeat(10 * 1024 * 1024 + 1),
				},
			},
		});

		expect(result.success).toBe(false);
		if (result.success) {
			throw new Error('Expected oversized canvas payload to fail validation');
		}
		expect(result.error.issues[0]?.message).toBe('Canvas data exceeds the 10MB size limit.');
	});

	it('requires an expected version when saving canvas data', () => {
		const result = canvasSchemas.save.safeParse({
			elements: [],
			appState: {},
			files: null,
		});

		expect(result.success).toBe(false);
		if (result.success) {
			throw new Error('Expected save payload without version to fail validation');
		}
		expect(result.error.issues[0]?.path).toEqual(['expectedVersion']);
	});

	it('parses heavy resource references and records', () => {
		const reference = canvasSchemas.canvasHeavyResourceReference.parse({
			resourceType: 'board',
			resourceId: 'board-1',
			title: 'Launch Board',
		});
		expect(reference).toEqual({
			resourceType: 'board',
			resourceId: 'board-1',
			title: 'Launch Board',
		});

		const boardRecord = canvasSchemas.heavyResourceRecord.parse({
			id: 'board-1',
			canvasId: 'canvas-1',
			resourceType: 'board',
			title: 'Launch Board',
			createdAt: '2026-03-27T12:00:00.000Z',
			updatedAt: '2026-03-27T12:30:00.000Z',
			data: {
				type: 'kanban',
				title: 'Launch Board',
				columns: [],
			},
		});

		expect(boardRecord).toMatchObject({
			resourceType: 'board',
			data: {
				type: 'kanban',
				title: 'Launch Board',
			},
		});

		const prototypeRecord = canvasSchemas.prototypeResourceRecord.parse({
			id: 'prototype-1',
			canvasId: 'canvas-1',
			resourceType: 'prototype',
			title: 'Prototype',
			createdAt: '2026-03-27T12:00:00.000Z',
			updatedAt: '2026-03-27T12:30:00.000Z',
			data: {
				type: 'prototype',
				title: 'Prototype',
				template: 'react',
				files: {},
				dependencies: {},
			},
		});

		expect(prototypeRecord).toMatchObject({
			resourceType: 'prototype',
			data: {
				type: 'prototype',
				title: 'Prototype',
			},
		});

		const snapshot = canvasSchemas.canvasResourceSnapshot.parse({
			resourceType: 'document',
			resourceId: 'document-1',
			title: 'Launch Doc',
			snapshotVersion: 3,
			display: {
				subtitle: 'Draft',
				summary: 'A short resource card summary',
				badge: 'Phase 0',
			},
		});

		expect(snapshot).toMatchObject({
			resourceType: 'document',
			resourceId: 'document-1',
			title: 'Launch Doc',
			snapshotVersion: 3,
			display: {
				subtitle: 'Draft',
				summary: 'A short resource card summary',
				badge: 'Phase 0',
			},
		});
	});
});
