import { describe, expect, it } from 'vitest';
import { assistantSchemas } from './assistant';

describe('assistant schemas', () => {
	it('requires threadId for run creation', () => {
		const result = assistantSchemas.createRun.safeParse({
			message: 'Help me summarize this canvas',
			contextMode: 'all',
		});

		expect(result.success).toBe(false);
	});

	it('requires canvasId for run creation', () => {
		const result = assistantSchemas.createRun.safeParse({
			threadId: 'thread-1',
			message: 'Help me summarize this canvas',
			contextMode: 'all',
		});

		expect(result.success).toBe(false);
	});

	it('normalizes custom thread titles', () => {
		const result = assistantSchemas.createThread.parse({
			canvasId: 'canvas-123',
			title: '   Sprint   planning   ',
		});

		expect(result).toEqual({
			canvasId: 'canvas-123',
			title: 'Sprint planning',
		});
	});

	it('accepts canvas-scoped thread listing requests', () => {
		expect(
			assistantSchemas.listThreads.parse({
				canvasId: 'canvas-abc',
			}),
		).toEqual({
			canvasId: 'canvas-abc',
		});
	});

	it('accepts typed selected-context snapshots on runs', () => {
		const result = assistantSchemas.createRun.parse({
			threadId: 'thread-1',
			canvasId: 'canvas-1',
			message: 'Update this note',
			contextMode: 'selected',
			selectedElementIds: ['note-1'],
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 3,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Release checklist',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Checklist',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: '# Release checklist',
						},
					},
				],
			},
		});

		expect(result.contextSnapshot?.selectedContexts[0]).toMatchObject({
			kind: 'markdown',
			id: 'note-1',
		});
	});
});
