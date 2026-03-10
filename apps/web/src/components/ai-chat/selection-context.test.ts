import { describe, expect, it } from 'vitest';
import {
	buildSelectionIndicator,
	getSelectedElementIdsFromMap,
	shouldConfirmSelectionForPrompt,
} from './selection-context';

describe('selection context helpers', () => {
	it('returns selected ids from the appState map', () => {
		expect(
			getSelectedElementIdsFromMap({
				a: true,
				b: false,
				c: true,
			}),
		).toEqual(['a', 'c']);
	});

	it('prioritizes markdown and reports a useful indicator', () => {
		const indicator = buildSelectionIndicator(
			[
				{
					id: 'shape-1',
					type: 'rectangle',
				},
				{
					id: 'note-1',
					type: 'rectangle',
					customData: {
						type: 'markdown',
						content: '# Release checklist',
					},
				},
				{
					id: 'board-1',
					type: 'rectangle',
					customData: {
						type: 'kanban',
						title: 'Launch',
						columns: [],
					},
				},
			],
			{
				'note-1': true,
				'board-1': true,
			},
		);

		expect(indicator).toEqual({
			count: 2,
			label: '2 selected',
			detail: '1 markdown note, 1 more item.',
		});
	});

	it('prompts for confirmation when the prompt refers to the selection', () => {
		expect(
			shouldConfirmSelectionForPrompt({
				contextMode: 'none',
				prompt: 'Turn this into kanban tasks',
				selectionCount: 1,
			}),
		).toBe(true);
		expect(
			shouldConfirmSelectionForPrompt({
				contextMode: 'selected',
				prompt: 'Turn this into kanban tasks',
				selectionCount: 1,
			}),
		).toBe(false);
		expect(
			shouldConfirmSelectionForPrompt({
				contextMode: 'none',
				prompt: 'Diagram the auth flow',
				selectionCount: 1,
			}),
		).toBe(false);
	});
});
