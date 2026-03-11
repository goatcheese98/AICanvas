import { describe, expect, it, vi } from 'vitest';
import { buildAssistantContextSnapshot, summarizeAssistantContextSnapshot } from './context';

describe('assistant context', () => {
	it('builds a snapshot from stored canvas data', async () => {
		const snapshot = await buildAssistantContextSnapshot(
			{
				DB: {} as D1Database,
				R2: {
					get: vi.fn(async () => ({
						json: async () => ({
							elements: [
								{
									id: 'board-1',
									type: 'rectangle',
									customData: {
										type: 'kanban',
										title: 'Launch board',
										columns: [{ id: 'todo', title: 'To Do', cards: [] }],
									},
								},
								{
									id: 'shape-1',
									type: 'rectangle',
								},
								{
									id: 'note-1',
									type: 'rectangle',
									customData: {
										type: 'markdown',
										title: 'Roadmap',
										content: 'Quarterly roadmap',
									},
								},
								{
									id: 'diagram-1',
									type: 'image',
									customData: {
										type: 'ai-generated-diagram',
										title: 'Auth flow',
										language: 'mermaid',
										code: 'flowchart TD\nA --> B',
									},
								},
							],
							appState: {},
							files: {},
						}),
					})),
				} as unknown as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ENVIRONMENT: 'test',
			} as {
				DB: D1Database;
				R2: R2Bucket;
				CLERK_SECRET_KEY: string;
				ENVIRONMENT: string;
			},
			'user-1',
			'canvas-1',
			['diagram-1', 'board-1', 'note-1'],
		);

		expect(snapshot).toMatchObject({
			canvasId: 'canvas-1',
			totalElementCount: 4,
			selectedElementCount: 3,
			selectedOverlayTypes: ['markdown', 'kanban'],
		});
		expect(snapshot.selectionSummary[0]).toMatchObject({
			id: 'note-1',
			label: 'Roadmap',
		});
		expect(snapshot.selectedContexts.map((context) => context.kind)).toEqual([
			'markdown',
			'kanban',
			'generated-diagram',
		]);
		expect(snapshot.selectedContexts[0]).toMatchObject({
			kind: 'markdown',
			markdown: {
				content: 'Quarterly roadmap',
			},
		});
		expect(snapshot.selectedContexts[1]).toMatchObject({
			kind: 'kanban',
			kanban: {
				title: 'Launch board',
			},
			kanbanSummary: {
				columnCount: 1,
				cardCount: 0,
			},
		});
		expect(snapshot.selectedContexts[2]).toMatchObject({
			kind: 'generated-diagram',
			diagram: {
				language: 'mermaid',
				code: 'flowchart TD\nA --> B',
			},
		});
	});

	it('summarizes a snapshot for prompt context', () => {
		const summary = summarizeAssistantContextSnapshot({
			canvasId: 'canvas-1',
			totalElementCount: 8,
			selectedElementIds: ['a', 'b'],
			selectedElementCount: 2,
			selectedOverlayTypes: ['markdown', 'prototype'],
			selectionSummary: [
				{
					id: 'a',
					elementType: 'rectangle',
					overlayType: 'markdown',
					label: 'Release checklist',
				},
			],
			selectedContexts: [
				{
					kind: 'markdown',
					id: 'a',
					priority: 1,
					elementType: 'rectangle',
					overlayType: 'markdown',
					label: 'Release checklist',
					markdown: {
						type: 'markdown',
						title: 'Release checklist',
						content: '# Release checklist\n- [ ] Ship it',
					},
				},
			],
		});

		expect(summary).toContain('Canvas snapshot: 8 elements.');
		expect(summary).toContain('Selected overlay types: markdown, prototype.');
		expect(summary).toContain('Release checklist');
		expect(summary).toContain('```markdown');
		expect(summary).toContain('# Release checklist');
	});
});
