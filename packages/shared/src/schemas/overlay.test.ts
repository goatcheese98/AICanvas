import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizeMarkdownSettings,
	normalizeNewLexOverlay,
	normalizeWebEmbedOverlay,
} from './overlay';

describe('overlay schemas', () => {
	it('normalizes markdown note settings with defaults and bounds', () => {
		expect(normalizeMarkdownSettings()).toEqual(DEFAULT_MARKDOWN_NOTE_SETTINGS);
		expect(
			normalizeMarkdownSettings({
				font: 'Mono',
				fontSize: 999,
				background: '#fff',
				lineHeight: 0.5,
				showEmptyLines: false,
				autoHideToolbar: true,
			}),
		).toEqual({
			font: 'Mono',
			fontSize: 28,
			background: '#fff',
			lineHeight: 1.2,
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

	it('normalizes newlex overlay payloads', () => {
		expect(
			normalizeNewLexOverlay({
				lexicalState: '{"root":{}}',
			}),
		).toMatchObject({
			type: 'newlex',
			lexicalState: '{"root":{}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
		});
	});

	it('normalizes kanban overlay payloads and fills defaults', () => {
		const normalized = normalizeKanbanOverlay({
			title: 'Roadmap',
			columns: [{ title: 'Todo', cards: [{ title: 'Ship it' }] }] as any,
		});

		expect(normalized).toMatchObject({
			type: 'kanban',
			title: 'Roadmap',
			bgTheme: 'parchment',
			fontId: 'excalifont',
			fontSize: 13,
		});
		expect(normalized.columns[0]).toMatchObject({
			title: 'Todo',
		});
		expect(normalized.columns[0]?.cards[0]).toMatchObject({
			title: 'Ship it',
			priority: 'medium',
		});
	});

	it('normalizes web embed payloads', () => {
		expect(normalizeWebEmbedOverlay({ url: 'https://example.com' })).toEqual({
			type: 'web-embed',
			url: 'https://example.com',
		});
	});
});
