import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	normalizeMarkdownOverlay,
	normalizeMarkdownSettings,
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
			}),
		).toEqual({
			font: 'Mono',
			fontSize: 28,
			background: '#fff',
			lineHeight: 1.2,
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
			content: '# Title',
			images: { one: 'data:image/png;base64,abc' },
			settings: DEFAULT_MARKDOWN_NOTE_SETTINGS,
			editorMode: 'raw',
		});
	});
});
