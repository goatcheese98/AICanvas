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
		expect((result.elements[1]?.customData as { columns: unknown[] }).columns).toHaveLength(3);
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
});
