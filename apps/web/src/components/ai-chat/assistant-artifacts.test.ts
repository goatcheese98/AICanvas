import type { AssistantArtifact } from '@ai-canvas/shared/types';
import { describe, expect, it, vi } from 'vitest';
import {
	applyAcceptedMarkdownPatchHunks,
	buildKanbanFromArtifact,
	buildMarkdownArtifactContent,
	buildMarkdownPatchDiff,
	buildMarkdownPatchHunks,
	buildPrototypeFromArtifact,
	buildPrototypeFromMessageContent,
	detectMarkdownPatchConflict,
	filterVisibleArtifacts,
	getDiagramArtifactSource,
	parseKanbanPatchArtifact,
	parseMarkdownPatchArtifact,
	parsePrototypePatchArtifact,
	summarizeKanbanPatchChanges,
} from './assistant-artifacts';

describe('assistant-artifacts', () => {
	it('builds markdown content for code artifacts', () => {
		const artifact: AssistantArtifact = {
			type: 'mermaid',
			content: 'flowchart TD\n  A --> B',
		};

		expect(buildMarkdownArtifactContent(artifact)).toContain('```mermaid');
		expect(buildMarkdownArtifactContent(artifact)).toContain('A --> B');
	});

	it('extracts diagram source from markdown-wrapped D2 artifacts', () => {
		const artifact: AssistantArtifact = {
			type: 'markdown',
			content: ['# D2 Draft', '', '```d2', 'a -> b', '```'].join('\n'),
		};

		expect(getDiagramArtifactSource(artifact)).toEqual({
			language: 'd2',
			code: 'a -> b',
		});
	});

	it('filters duplicate diagram artifacts that share the same source', () => {
		const artifacts: AssistantArtifact[] = [
			{ type: 'd2', content: 'a -> b' },
			{ type: 'markdown', content: ['# D2 Draft', '', '```d2', 'a -> b', '```'].join('\n') },
			{ type: 'layout-plan', content: '{"x":0}' },
		];

		expect(filterVisibleArtifacts(artifacts)).toEqual([{ type: 'd2', content: 'a -> b' }]);
	});

	it('keeps markdown-wrapped diagrams visible when no native artifact exists', () => {
		const artifacts: AssistantArtifact[] = [
			{
				type: 'markdown',
				content: ['# Mermaid Draft', '', '```mermaid', 'flowchart TD', 'A --> B', '```'].join('\n'),
			},
		];

		expect(filterVisibleArtifacts(artifacts)).toEqual(artifacts);
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

	it('builds a kanban board from flat assistant ops', () => {
		const artifact: AssistantArtifact = {
			type: 'kanban-ops',
			content: JSON.stringify([
				{ operation: 'add_column', id: 'col_1', title: 'To Do', order: 0 },
				{ operation: 'add_column', id: 'col_2', title: 'In Progress', order: 1 },
				{
					operation: 'add_card',
					id: 'card_1',
					column_id: 'col_1',
					title: 'Athletes Selection',
					description: 'Finalize roster',
				},
			]),
		};

		const board = buildKanbanFromArtifact(artifact);

		expect(board.columns).toHaveLength(2);
		expect(board.columns[0]?.title).toBe('To Do');
		expect(board.columns[0]?.cards[0]?.title).toBe('Athletes Selection');
	});

	it('builds a kanban board from wrapped operations payloads', () => {
		const artifact: AssistantArtifact = {
			type: 'kanban-ops',
			content: JSON.stringify({
				operations: [
					{ type: 'add_column', id: 'col_1', title: 'To Do', position: 0 },
					{ type: 'add_column', id: 'col_2', title: 'In Progress', position: 1 },
					{ type: 'add_column', id: 'col_3', title: 'Done', position: 2 },
					{
						type: 'add_card',
						id: 'card_1',
						column_id: 'col_1',
						title: 'Chemistry Lab Report',
						description: 'Due Wednesday',
						position: 0,
					},
					{
						type: 'add_card',
						id: 'card_2',
						column_id: 'col_2',
						title: 'History Project',
						description: 'Presentation outline',
						position: 0,
					},
				],
			}),
		};

		const board = buildKanbanFromArtifact(artifact);

		expect(board.columns).toHaveLength(3);
		expect(board.columns[0]?.title).toBe('To Do');
		expect(board.columns[0]?.cards[0]?.title).toBe('Chemistry Lab Report');
		expect(board.columns[1]?.cards[0]?.title).toBe('History Project');
	});

	it('builds a kanban board from update-card ops using a selected board as the base', () => {
		const artifact: AssistantArtifact = {
			type: 'kanban-ops',
			content: JSON.stringify({
				operations: [
					{
						op: 'update_card',
						column: 'To Do',
						card_index: 0,
						updates: {
							title: 'Review assignment brief',
							priority: 'high',
							labels: ['urgent', 'start-here'],
							checklist: ['Read rubric', 'Mark due date'],
						},
					},
				],
			}),
		};

		const board = buildKanbanFromArtifact(artifact, {
			type: 'kanban',
			title: 'Student work',
			columns: [
				{
					id: 'todo',
					title: 'To Do',
					cards: [
						{
							id: 'card-1',
							title: 'Old title',
							checklist: [],
						},
					],
				},
				{ id: 'done', title: 'Done', cards: [] },
			],
		});

		expect(board.columns[0]?.cards[0]?.title).toBe('Review assignment brief');
		expect(board.columns[0]?.cards[0]?.priority).toBe('high');
		expect(board.columns[0]?.cards[0]?.checklist).toEqual([
			{ text: 'Read rubric', done: false },
			{ text: 'Mark due date', done: false },
		]);
	});

	it('parses markdown patch artifacts and builds a simple diff', () => {
		const artifact: AssistantArtifact = {
			type: 'markdown-patch',
			content: JSON.stringify({
				kind: 'markdown_patch',
				targetId: 'note-1',
				summary: 'Adds an AI update.',
				base: { title: 'Notes', content: '# Notes\n\nOld line' },
				next: { title: 'Notes', content: '# Notes\n\nOld line\n\n## AI Update\n\n- New line' },
			}),
		};

		const patch = parseMarkdownPatchArtifact(artifact);
		const diff = buildMarkdownPatchDiff(patch!.base, patch!.next);

		expect(patch?.targetId).toBe('note-1');
		expect(diff.some((line) => line.type === 'add' && line.text.includes('AI Update'))).toBe(true);
	});

	it('parses prototype patch artifacts', () => {
		const artifact: AssistantArtifact = {
			type: 'prototype-patch',
			content: JSON.stringify({
				kind: 'prototype_patch',
				targetId: 'prototype-1',
				summary: 'Updates the selected prototype.',
				base: {
					type: 'prototype',
					title: 'Prototype',
					template: 'react',
					activeFile: '/App.jsx',
					files: {
						'/App.jsx': { code: "export default function App() { return <div>Old</div>; }" },
					},
				},
				next: {
					type: 'prototype',
					title: 'Working Demo',
					template: 'react',
					activeFile: '/App.jsx',
					files: {
						'/App.jsx': { code: "export default function App() { return <button>Play</button>; }" },
					},
				},
				changedFiles: ['/App.jsx'],
			}),
		};

		const patch = parsePrototypePatchArtifact(artifact);

		expect(patch?.targetId).toBe('prototype-1');
		expect(patch?.changedFiles).toEqual(['/App.jsx']);
		expect(patch?.next.title).toBe('Working Demo');
	});

	it('groups markdown edits into multiple review hunks', () => {
		const hunks = buildMarkdownPatchHunks(
			{
				content: [
					'# Grocery List',
					'',
					'## Protein',
					'- Beef chuck',
					'- Brisket',
					'',
					'## Spices',
					'- Cumin',
					'- Paprika',
					'',
					'## Toppings',
					'- Jalapenos',
				].join('\n'),
			},
			{
				content: [
					'# Grocery List',
					'',
					'## Protein',
					'- Chicken thighs',
					'',
					'## Spices',
					'- Cumin',
					'- Smoked paprika',
					'',
					'## Toppings',
					'- Jalapenos',
				].join('\n'),
			},
		);

		expect(hunks).toHaveLength(2);
		expect(hunks[0]?.removedLineCount).toBe(2);
		expect(hunks[0]?.addedLineCount).toBe(1);
		expect(
			hunks[1]?.lines.some((line) => line.type === 'add' && line.text === '- Smoked paprika'),
		).toBe(true);
	});

	it('applies only accepted markdown hunks', () => {
		const baseContent = [
			'# Grocery List',
			'',
			'## Protein',
			'- Beef chuck',
			'- Brisket',
			'',
			'## Spices',
			'- Cumin',
			'- Paprika',
		].join('\n');
		const nextContent = [
			'# Grocery List',
			'',
			'## Protein',
			'- Chicken thighs',
			'',
			'## Spices',
			'- Cumin',
			'- Smoked paprika',
		].join('\n');

		const hunks = buildMarkdownPatchHunks({ content: baseContent }, { content: nextContent });
		const merged = applyAcceptedMarkdownPatchHunks(baseContent, hunks, [hunks[0]!.id]);

		expect(merged).toContain('- Chicken thighs');
		expect(merged).toContain('- Paprika');
		expect(merged).not.toContain('- Smoked paprika');
	});

	it('detects markdown patch conflicts against live note content', () => {
		const baseContent = ['# Grocery List', '', '## Protein', '- Beef chuck', '- Brisket'].join(
			'\n',
		);
		const nextContent = ['# Grocery List', '', '## Protein', '- Chicken thighs'].join('\n');

		expect(detectMarkdownPatchConflict(baseContent, baseContent, nextContent)).toBe('clean');
		expect(detectMarkdownPatchConflict(nextContent, baseContent, nextContent)).toBe(
			'already-applied',
		);
		expect(
			detectMarkdownPatchConflict(
				['# Grocery List', '', '## Protein', '- Tofu'].join('\n'),
				baseContent,
				nextContent,
			),
		).toBe('modified');
	});

	it('parses kanban patch artifacts and summarizes changes', () => {
		const artifact: AssistantArtifact = {
			type: 'kanban-patch',
			content: JSON.stringify({
				kind: 'kanban_patch',
				targetId: 'board-1',
				summary: 'Adds a new assistant task.',
				operations: [{ type: 'add_card', column_id: 'todo', title: 'QA follow-up' }],
				base: {
					type: 'kanban',
					title: 'Launch board',
					columns: [{ id: 'todo', title: 'To Do', cards: [] }],
					bgTheme: 'parchment',
					fontId: 'excalifont',
					fontSize: 13,
				},
				next: {
					type: 'kanban',
					title: 'Launch board',
					columns: [
						{
							id: 'todo',
							title: 'To Do',
							cards: [{ id: 'card-1', title: 'QA follow-up', description: '', priority: 'medium' }],
						},
					],
					bgTheme: 'parchment',
					fontId: 'excalifont',
					fontSize: 13,
				},
			}),
		};

		const patch = parseKanbanPatchArtifact(artifact);
		const changes = summarizeKanbanPatchChanges(patch!);

		expect(patch?.targetId).toBe('board-1');
		expect(buildKanbanFromArtifact(artifact).columns[0]?.cards[0]?.title).toBe('QA follow-up');
		expect(changes).toContain('Add card "QA follow-up" to "To Do"');
	});

	it('builds a prototype overlay from prototype file artifacts', () => {
		const artifact: AssistantArtifact = {
			type: 'prototype-files',
			content: JSON.stringify({
				title: 'PromptVault Landing',
				template: 'react',
				activeFile: '/App.jsx',
				files: {
					'/App.jsx': {
						code: 'export default function App() { return <main>PromptVault</main>; }',
					},
					'/index.jsx': { code: "import { createRoot } from 'react-dom/client';" },
					'/styles.css': { code: 'main { color: #111827; }' },
				},
			}),
		};

		const prototype = buildPrototypeFromArtifact(artifact);

		expect(prototype.title).toBe('PromptVault Landing');
		expect(prototype.files['/App.jsx']?.code).toContain('PromptVault');
		expect(prototype.files['/styles.css']?.code).toContain('#111827');
	});

	it('builds a vanilla prototype overlay from assistant message code blocks', () => {
		const prototype = buildPrototypeFromMessageContent(
			[
				'# Calculator App',
				'',
				'```html',
				'<!DOCTYPE html><html><body><div id="app"></div><script type="module" src="./index.js"></script></body></html>',
				'```',
				'',
				'```css',
				'body { background: #f8fafc; }',
				'```',
				'',
				'```javascript',
				"document.getElementById('app').textContent = 'ready';",
				'```',
			].join('\n'),
		);

		expect(prototype?.template).toBe('vanilla');
		expect(prototype?.files['/index.html']?.code).toContain('<div id="app">');
		expect(prototype?.files['/index.js']?.code).toContain("textContent = 'ready'");
	});
});
