import { describe, expect, it } from 'vitest';
import { planAssistantRun } from './planner';

describe('assistant planner', () => {
	it('plans a diagram task for diagram-oriented prompts', () => {
		const plan = planAssistantRun({
			message: 'diagram the auth flow',
			contextMode: 'all',
		});

		expect(plan.resolvedMode).toBe('mermaid');
		expect(plan.tasks.map((task) => task.type)).toEqual([
			'generate_response',
			'place_canvas_artifact',
			'verify_run',
		]);
	});

	it('keeps diagram follow-ups in the last diagram mode', () => {
		const plan = planAssistantRun({
			message: 'can you render it?',
			contextMode: 'all',
			history: [
				{
					id: 'assistant-1',
					role: 'assistant',
					content: '```d2\na -> b\n```',
					generationMode: 'd2',
					artifacts: [{ type: 'd2', content: 'a -> b' }],
					createdAt: new Date().toISOString(),
				},
			],
		});

		expect(plan.resolvedMode).toBe('d2');
	});

	it('respects an explicit mode hint when present', () => {
		const plan = planAssistantRun({
			message: 'help me with this canvas',
			contextMode: 'selected',
			modeHint: 'kanban',
		});

		expect(plan.resolvedMode).toBe('kanban');
		expect(plan.tasks[0]?.title).toBe('Generate Kanban operations');
	});

	it('plans a raster-only image pipeline when vectorization is unavailable', () => {
		const plan = planAssistantRun({
			message: 'create a hero illustration for this idea',
			contextMode: 'all',
		});

		expect(plan.resolvedMode).toBe('image');
		expect(plan.tasks.map((task) => task.type)).toEqual([
			'generate_image',
			'generate_response',
			'verify_run',
		]);
		expect(plan.tasks[0]?.input).toMatchObject({
			kind: 'generate_image',
			style: 'image',
		});
	});

	it('plans a vectorized image pipeline when vectorization is enabled', () => {
		const plan = planAssistantRun({
			message: 'create a hero illustration for this idea',
			contextMode: 'all',
			vectorizationEnabled: true,
		});

		expect(plan.resolvedMode).toBe('image');
		expect(plan.tasks.map((task) => task.type)).toEqual([
			'generate_image',
			'generate_response',
			'verify_run',
		]);
		expect(plan.tasks[1]?.input).toMatchObject({
			kind: 'generate_response',
			includeArtifactTypes: ['image'],
		});
	});

	it('only enables vectorization for sketch runs', () => {
		const plan = planAssistantRun({
			message: 'make a whiteboard sketch of the checkout flow',
			contextMode: 'all',
			vectorizationEnabled: true,
		});

		expect(plan.resolvedMode).toBe('sketch');
		expect(plan.tasks.map((task) => task.type)).toEqual([
			'generate_image',
			'vectorize_asset',
			'generate_response',
			'verify_run',
		]);
		expect(plan.tasks[1]?.input).toMatchObject({
			kind: 'vectorize_asset',
			sourceArtifactType: 'image',
		});
	});

	it('reuses the prior image prompt for image refinements', () => {
		const plan = planAssistantRun({
			message: "Let's do it with a beach boardwalk combo.",
			contextMode: 'selected',
			history: [
				{
					id: 'assistant-image-1',
					role: 'assistant',
					content: 'Generated image preview',
					generationMode: 'image',
					artifacts: [
						{
							type: 'image',
							content: JSON.stringify({
								kind: 'stored_asset',
								r2Key: 'assistant-assets/run-1/pelican.png',
								mimeType: 'image/png',
								provider: 'cloudflare',
								prompt: 'Create a polished image for: Can you create an image of a pelican riding a bicycle?',
							}),
						},
					],
					createdAt: new Date().toISOString(),
				},
			],
		});

		expect(plan.resolvedMode).toBe('image');
		expect(plan.tasks[0]?.input).toMatchObject({
			kind: 'generate_image',
			prompt: expect.stringContaining('pelican riding a bicycle'),
		});
		expect(plan.tasks[0]?.input).toMatchObject({
			prompt: expect.stringContaining('beach boardwalk combo'),
		});
	});

	it('plans a prototype response for prototype requests', () => {
		const plan = planAssistantRun({
			message: 'build a prototype dashboard for sales ops',
			contextMode: 'selected',
		});

		expect(plan.resolvedMode).toBe('prototype');
		expect(plan.tasks.map((task) => task.type)).toEqual([
			'generate_response',
			'place_canvas_artifact',
			'verify_run',
		]);
		expect(plan.tasks[0]?.input).toMatchObject({
			kind: 'generate_response',
			includeArtifactTypes: ['prototype-files'],
		});
	});

	it('expects kanban patches for selected kanban edit runs', () => {
		const plan = planAssistantRun({
			message: 'add a triage task for QA follow-up',
			contextMode: 'selected',
			modeHint: 'kanban',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['board-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['kanban'],
				canvasSummary: {
					elementTypeCounts: { rectangle: 1 },
					overlayTypeCounts: { kanban: 1 },
					textBearingElementCount: 1,
					editableOverlayCount: 1,
					selectedCount: 1,
					hasKanban: true,
					hasMarkdown: false,
					hasPrototype: false,
					highlights: ['Launch board'],
				},
				selectionSummary: [
					{
						id: 'board-1',
						elementType: 'rectangle',
						overlayType: 'kanban',
						label: 'Launch board',
					},
				],
				selectedContexts: [
					{
						kind: 'kanban',
						id: 'board-1',
						priority: 2,
						elementType: 'rectangle',
						overlayType: 'kanban',
						label: 'Launch board',
						textExcerpt: 'Launch board',
						kanban: {
							type: 'kanban',
							title: 'Launch board',
							columns: [{ id: 'todo', title: 'To Do', cards: [] }],
							bgTheme: 'parchment',
							fontId: 'excalifont',
							fontSize: 13,
						},
						kanbanSummary: {
							title: 'Launch board',
							columnCount: 1,
							cardCount: 0,
							emptyColumnCount: 1,
							cardsWithDescriptions: 0,
							overdueCardCount: 0,
							completedChecklistItemCount: 0,
							totalChecklistItemCount: 0,
							priorityCounts: { low: 0, medium: 0, high: 0 },
							labels: [],
							columns: [{ id: 'todo', title: 'To Do', cardCount: 0, cards: [] }],
						},
					},
				],
			},
		});

		expect(plan.resolvedMode).toBe('kanban');
		expect(plan.tasks[0]?.input).toMatchObject({
			kind: 'generate_response',
			includeArtifactTypes: ['kanban-patch'],
		});
		expect(plan.tasks[1]?.input).toMatchObject({
			kind: 'verify_run',
			requiredArtifactTypes: ['kanban-patch'],
		});
	});
});
