import { describe, expect, it } from 'vitest';
import {
	MARKDOWN_IMAGE_SCHEME,
	appendBlock,
	createMarkdownImageToken,
	resolveMarkdownImageSrc,
	toggleMarkdownCheckboxLine,
} from './markdown-utils';

describe('markdown-utils', () => {
	it('creates markdown image tokens with the custom image scheme', () => {
		expect(createMarkdownImageToken('img-1')).toBe(`![image](${MARKDOWN_IMAGE_SCHEME}img-1)`);
		expect(createMarkdownImageToken('img-2', 'diagram')).toBe(`![diagram](${MARKDOWN_IMAGE_SCHEME}img-2)`);
	});

	it('resolves custom image references from the overlay image map', () => {
		expect(resolveMarkdownImageSrc('image://img-1', { 'img-1': 'data:image/png;base64,abc' })).toBe(
			'data:image/png;base64,abc',
		);
		expect(resolveMarkdownImageSrc('https://example.com/a.png', { 'img-1': 'x' })).toBe(
			'https://example.com/a.png',
		);
		expect(resolveMarkdownImageSrc('image://missing', { 'img-1': 'x' })).toBeUndefined();
	});

	it('appends blocks with blank line separation', () => {
		expect(appendBlock('', '# Title')).toBe('# Title');
		expect(appendBlock('Hello', 'World')).toBe('Hello\n\nWorld');
	});

	it('toggles markdown task list lines', () => {
		expect(toggleMarkdownCheckboxLine('- [ ] Ship it', 0)).toBe('- [x] Ship it');
		expect(toggleMarkdownCheckboxLine('- [x] Ship it', 0)).toBe('- [ ] Ship it');
		expect(toggleMarkdownCheckboxLine('plain text', 0)).toBe('plain text');
	});
});
