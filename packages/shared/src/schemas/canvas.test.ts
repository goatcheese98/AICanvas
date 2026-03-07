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
			bgTheme: 'parchment',
		});
		expect((result.elements[1]?.customData as { columns: unknown[] }).columns).toHaveLength(3);
		expect(result.elements[2]?.customData).toBeUndefined();
	});
});
