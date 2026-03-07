import { describe, expect, it } from 'vitest';
import { convertToEmbedUrl, enhanceUrl, isKnownEmbeddable } from './web-embed-utils';

describe('web-embed-utils', () => {
	it('converts supported video URLs to embed URLs', () => {
		expect(convertToEmbedUrl('https://youtu.be/abc123')).toBe(
			'https://www.youtube.com/embed/abc123?autoplay=0&rel=0',
		);
		expect(convertToEmbedUrl('https://vimeo.com/12345')).toBe(
			'https://player.vimeo.com/video/12345',
		);
	});

	it('marks known sites as embeddable', () => {
		expect(isKnownEmbeddable('https://www.youtube.com/watch?v=abc123')).toBe(true);
		expect(isKnownEmbeddable('https://www.figma.com/file/abc123/example')).toBe(true);
		expect(isKnownEmbeddable('https://www.google.com')).toBe(false);
	});

	it('treats free text as a search query with warning', () => {
		const result = enhanceUrl('design systems');

		expect(result.isSearch).toBe(true);
		expect(result.url).toContain('google.com/search?q=');
		expect(result.warning).toContain("don't embed");
	});

	it('blocks unsupported homepages with helpful warnings', () => {
		const result = enhanceUrl('https://www.youtube.com');

		expect(result.isSearch).toBe(false);
		expect(result.warning).toContain("can't be previewed");
	});

	it('adds protocol and returns embed url when available', () => {
		const result = enhanceUrl('youtu.be/abc123');

		expect(result.url).toBe('https://youtu.be/abc123');
		expect(result.embedUrl).toBe('https://www.youtube.com/embed/abc123?autoplay=0&rel=0');
	});
});
