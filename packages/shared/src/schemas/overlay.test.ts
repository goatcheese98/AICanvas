import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizeMarkdownSettings,
	normalizeNewLexOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
	summarizeKanbanOverlay,
} from './overlay';

describe('overlay schemas', () => {
	it('normalizes markdown note settings with defaults and bounds', () => {
		expect(normalizeMarkdownSettings()).toEqual(DEFAULT_MARKDOWN_NOTE_SETTINGS);
		expect(
			normalizeMarkdownSettings({
				font: 'Mono',
				fontSize: 0,
				background: '#fff',
				lineHeight: 0.5,
				inlineCodeColor: '#ff0000',
				showEmptyLines: false,
				autoHideToolbar: true,
			}),
		).toEqual({
			font: 'Mono',
			fontSize: 8,
			background: '#fff',
			lineHeight: 1.2,
			inlineCodeColor: '#ff0000',
			showEmptyLines: false,
			autoHideToolbar: true,
		});
		expect(
			normalizeMarkdownSettings({
				font: 'Mono',
				fontSize: 999,
				background: '#fff',
				lineHeight: 0.5,
				inlineCodeColor: '#ff0000',
				showEmptyLines: false,
				autoHideToolbar: true,
			}),
		).toEqual({
			font: 'Mono',
			fontSize: 28,
			background: '#fff',
			lineHeight: 1.2,
			inlineCodeColor: '#ff0000',
			showEmptyLines: false,
			autoHideToolbar: true,
		});
	});

	it('normalizes markdown overlay payloads', () => {
		expect(
			normalizeMarkdownOverlay({
				content: '# Title',
				images: { one: 'data:image/png;base64,abc' },
			}),
		).toEqual({
			type: 'markdown',
			title: 'Markdown',
			content: '# Title',
			images: { one: 'data:image/png;base64,abc' },
			settings: DEFAULT_MARKDOWN_NOTE_SETTINGS,
			editorMode: 'raw',
		});
	});

	it('normalizes markdown title length and markdown settings defaults together', () => {
		expect(
			normalizeMarkdownOverlay({
				title: '  Strategy  ',
				content: 'Hello',
				settings: {
					font: 'Nunito, sans-serif',
					fontSize: 16,
					background: '#fff',
					lineHeight: 1.5,
					inlineCodeColor: '#2563eb',
					showEmptyLines: false,
					autoHideToolbar: true,
				},
			}),
		).toMatchObject({
			type: 'markdown',
			title: 'Strategy',
			content: 'Hello',
			editorMode: 'raw',
			settings: {
				showEmptyLines: false,
				autoHideToolbar: true,
			},
		});
	});

	it('normalizes newlex overlay payloads', () => {
		expect(
			normalizeNewLexOverlay({
				lexicalState: '{"root":{}}',
			}),
		).toMatchObject({
			type: 'newlex',
			title: 'Rich Text',
			lexicalState: '{"root":{}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
		});
	});

	it('normalizes kanban overlay payloads and fills defaults', () => {
		const normalized = normalizeKanbanOverlay({
			title: 'Roadmap',
			columns: [{ title: 'Todo', cards: [{ title: 'Ship it' }] }] as NonNullable<
				Parameters<typeof normalizeKanbanOverlay>[0]
			>['columns'],
		});

		expect(normalized).toMatchObject({
			type: 'kanban',
			title: 'Roadmap',
		});
		expect(normalized.columns[0]).toMatchObject({
			title: 'Todo',
		});
		expect(normalized.columns[0]?.cards[0]).toMatchObject({
			title: 'Ship it',
			priority: 'medium',
		});
	});

	it('provides a starter kanban template when no columns are supplied', () => {
		const normalized = normalizeKanbanOverlay({});
		expect(normalized.columns).toHaveLength(3);
		expect(normalized.columns.some((column) => column.cards.length > 0)).toBe(true);
	});

	it('summarizes kanban overlays into AI-friendly board stats', () => {
		const summary = summarizeKanbanOverlay({
			title: 'Launch board',
			columns: [
				{
					id: 'todo',
					title: 'To Do',
					cards: [
						{
							id: 'card-1',
							title: 'Ship docs',
							description: 'Draft release notes',
							priority: 'high',
							labels: ['docs', 'launch'],
							checklist: [
								{ id: 'check-1', text: 'Outline', done: true },
								{ id: 'check-2', text: 'Review', done: false },
							],
						},
					],
				},
				{
					id: 'done',
					title: 'Done',
					cards: [],
				},
			],
		});

		expect(summary).toMatchObject({
			title: 'Launch board',
			columnCount: 2,
			cardCount: 1,
			emptyColumnCount: 1,
			cardsWithDescriptions: 1,
			completedChecklistItemCount: 1,
			totalChecklistItemCount: 2,
			priorityCounts: {
				low: 0,
				medium: 0,
				high: 1,
			},
			labels: ['docs', 'launch'],
		});
		expect(summary.columns[0]?.cards[0]).toMatchObject({
			title: 'Ship docs',
			priority: 'high',
			hasDescription: true,
		});
	});

	it('normalizes web embed payloads', () => {
		expect(normalizeWebEmbedOverlay({ url: 'https://example.com' })).toEqual({
			type: 'web-embed',
			url: 'https://example.com',
		});
	});

	it('normalizes prototype payloads without injecting starter files', () => {
		const normalized = normalizePrototypeOverlay({});

		expect(normalized).toEqual({
			type: 'prototype',
			title: 'Prototype',
			template: 'react',
			files: {},
			dependencies: {},
			activeFile: undefined,
			showEditor: true,
			showPreview: true,
		});
	});

	it('keeps provided prototype files as-is', () => {
		const normalized = normalizePrototypeOverlay({
			template: 'react',
			files: {
				'/index.jsx': {
					code: "import { createRoot } from 'react-dom/client';",
					hidden: true,
				},
				'/App.jsx': {
					code: 'export default function App() { return <div>Hello</div>; }',
					active: true,
				},
				'/styles.css': {
					code: 'body { margin: 0; }',
				},
			},
		});

		expect(normalized.activeFile).toBe('/App.jsx');
		expect(normalized.files['/App.jsx']?.active).toBe(true);
		expect(normalized.files['/index.jsx']?.hidden).toBe(true);
		expect(normalized.files['/styles.css']?.code).toBe('body { margin: 0; }');
	});

	it('falls back to the first visible file when the requested active file is missing', () => {
		const normalized = normalizePrototypeOverlay({
			activeFile: '/missing.jsx',
			files: {
				'/index.jsx': {
					code: "import { createRoot } from 'react-dom/client';",
					hidden: true,
				},
				'/App.jsx': { code: 'export default function App() { return <div>Hello</div>; }' },
				'/styles.css': { code: 'body { margin: 0; }' },
			},
		});

		expect(normalized.activeFile).toBe('/App.jsx');
		expect(normalized.files['/App.jsx']?.active).toBe(true);
		expect(normalized.files['/styles.css']?.active).toBe(false);
	});
});
