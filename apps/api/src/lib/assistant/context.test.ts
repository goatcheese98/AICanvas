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
			{
				canvasId: 'canvas-1',
				contextMode: 'all',
				selectedElementIds: ['diagram-1', 'board-1', 'note-1'],
				canvasMeta: {
					title: 'Product planning',
					description: 'Launch planning canvas',
				},
			},
		);

		expect(snapshot).toMatchObject({
			canvasId: 'canvas-1',
			totalElementCount: 4,
			selectedElementCount: 3,
			selectedOverlayTypes: ['markdown', 'kanban'],
			canvasMeta: {
				title: 'Product planning',
				description: 'Launch planning canvas',
			},
			canvasSummary: {
				hasKanban: true,
				hasMarkdown: true,
				selectedCount: 3,
			},
		});
		expect(snapshot.selectionSummary[0]).toMatchObject({
			id: 'note-1',
			label: 'Roadmap',
		});
		expect(snapshot.canvasElementSummaries?.[0]).toMatchObject({
			id: 'shape-1',
			elementType: 'rectangle',
		});
		expect(snapshot.selectedContexts[0]).toMatchObject({
			kind: 'markdown',
			bounds: undefined,
			textExcerpt: 'Quarterly roadmap',
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
			canvasMeta: {
				title: 'Launch canvas',
			},
			canvasSummary: {
				elementTypeCounts: { rectangle: 6, image: 2 },
				overlayTypeCounts: { markdown: 1, prototype: 1 },
				textBearingElementCount: 4,
				editableOverlayCount: 2,
				selectedCount: 2,
				hasKanban: false,
				hasMarkdown: true,
				hasPrototype: true,
				highlights: ['Release checklist', 'Prototype shell'],
			},
			canvasElementSummaries: [
				{
					id: 'frame-1',
					elementType: 'rectangle',
					label: 'Prototype shell',
				},
			],
			selectionEnvironment: [
				{
					id: 'shape-2',
					elementType: 'ellipse',
					label: 'Launch milestone',
					distanceFromSelection: 24,
				},
			],
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
					textExcerpt: '# Release checklist - [ ] Ship it',
					markdown: {
						type: 'markdown',
						title: 'Release checklist',
						content: '# Release checklist\n- [ ] Ship it',
					},
				},
			],
		});

		expect(summary).toContain('Canvas title: "Launch canvas".');
		expect(summary).toContain('Canvas summary: 4 text-bearing elements, 2 editable overlays, 2 selected.');
		expect(summary).toContain('Relevant canvas elements: rectangle | "Prototype shell".');
		expect(summary).toContain('Nearby selection context: ellipse | "Launch milestone" | distance 24.');
		expect(summary).toContain('Canvas snapshot: 8 elements.');
		expect(summary).toContain('Selected overlay types: markdown, prototype.');
		expect(summary).toContain('Release checklist');
		expect(summary).toContain('```markdown');
		expect(summary).toContain('# Release checklist');
	});
});
