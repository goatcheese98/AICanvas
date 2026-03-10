import { describe, expect, it } from 'vitest';
import { planAssistantRun } from './planner';

describe('assistant planner', () => {
	it('plans a diagram task for diagram-oriented prompts', () => {
		const plan = planAssistantRun({
			message: 'diagram the auth flow',
			contextMode: 'all',
		});

		expect(plan.resolvedMode).toBe('mermaid');
		expect(plan.tasks.map((task) => task.type)).toEqual(['generate_response', 'verify_run']);
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

	it('plans a multi-step image pipeline for image requests', () => {
		const plan = planAssistantRun({
			message: 'create a hero illustration for this idea',
			contextMode: 'all',
		});

		expect(plan.resolvedMode).toBe('image');
		expect(plan.tasks.map((task) => task.type)).toEqual([
			'generate_image',
			'vectorize_asset',
			'create_markdown_overlay',
			'place_canvas_artifact',
			'generate_response',
			'verify_layout',
			'verify_run',
		]);
		expect(plan.tasks[0]?.input).toMatchObject({
			kind: 'generate_image',
			style: 'image',
		});
	});

	it('plans a prototype response for prototype requests', () => {
		const plan = planAssistantRun({
			message: 'build a prototype dashboard for sales ops',
			contextMode: 'selected',
		});

		expect(plan.resolvedMode).toBe('prototype');
		expect(plan.tasks.map((task) => task.type)).toEqual(['generate_response', 'verify_run']);
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
						kanban: {
							type: 'kanban',
							title: 'Launch board',
							columns: [{ id: 'todo', title: 'To Do', cards: [] }],
							bgTheme: 'parchment',
							fontId: 'excalifont',
							fontSize: 13,
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
