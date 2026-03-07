import { describe, expect, it, vi } from 'vitest';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import { buildKanbanFromArtifact, buildMarkdownArtifactContent } from './assistant-artifacts';

describe('assistant-artifacts', () => {
	it('builds markdown content for code artifacts', () => {
		const artifact: AssistantArtifact = {
			type: 'mermaid',
			content: 'flowchart TD\n  A --> B',
		};

		expect(buildMarkdownArtifactContent(artifact)).toContain('```mermaid');
		expect(buildMarkdownArtifactContent(artifact)).toContain('A --> B');
	});

	it('builds a kanban board from kanban ops', () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
			.mockReturnValueOnce('22222222-2222-2222-2222-222222222222')
			.mockReturnValueOnce('33333333-3333-3333-3333-333333333333')
			.mockReturnValueOnce('44444444-4444-4444-4444-444444444444');

		const artifact: AssistantArtifact = {
			type: 'kanban-ops',
			content: JSON.stringify([
				{ op: 'add_column', column: { id: 'ai-next', title: 'AI Next' } },
				{
					op: 'add_card',
					columnId: 'ai-next',
					card: { title: 'Follow up', description: 'Generated card' },
				},
			]),
		};

		const board = buildKanbanFromArtifact(artifact);
		const aiColumn = board.columns.find((column) => column.id === 'ai-next');

		expect(board.title).toBe('AI Next Board');
		expect(aiColumn?.cards).toHaveLength(1);
		expect(aiColumn?.cards[0]?.title).toBe('Follow up');
	});
});
