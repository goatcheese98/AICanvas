import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	convertToEmbedUrl,
	enhanceUrl,
	getMicrolinkApiUrl,
	isKnownEmbeddable,
} from './web-embed-utils';

describe('web-embed-utils', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('converts supported provider URLs to embed URLs', () => {
		expect(convertToEmbedUrl('https://youtu.be/abc123')).toBe(
			'https://www.youtube.com/embed/abc123?autoplay=0&rel=0',
		);
		expect(convertToEmbedUrl('https://vimeo.com/12345')).toBe(
			'https://player.vimeo.com/video/12345',
		);
		expect(convertToEmbedUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(
			'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
		);
	});

	it('marks known sites as embeddable', () => {
		expect(isKnownEmbeddable('https://www.youtube.com/watch?v=abc123')).toBe(true);
		expect(isKnownEmbeddable('https://www.figma.com/file/abc123/example')).toBe(true);
		expect(isKnownEmbeddable('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(
			true,
		);
		expect(isKnownEmbeddable('https://www.google.com')).toBe(false);
	});

	it('treats free text as a search query with warning', () => {
		const result = enhanceUrl('design systems');

		expect(result.isSearch).toBe(true);
		expect(result.url).toContain('google.com/search?q=');
		expect(result.warning).toContain("don't embed");
	});

	it('lets arbitrary website URLs attempt to load without pre-blocking them', () => {
		const result = enhanceUrl('https://www.youtube.com');

		expect(result.isSearch).toBe(false);
		expect(result.url).toBe('https://www.youtube.com');
		expect(result.warning).toBeUndefined();
	});

	it('adds protocol and returns embed url when available', () => {
		const result = enhanceUrl('youtu.be/abc123');

		expect(result.url).toBe('https://youtu.be/abc123');
		expect(result.embedUrl).toBe('https://www.youtube.com/embed/abc123?autoplay=0&rel=0');
	});

	it('warns when a Google Maps link is pasted without a Maps embed API key', () => {
		const result = enhanceUrl('https://www.google.com/maps');

		expect(result.url).toBe('https://www.google.com/maps');
		expect(result.embedUrl).toBeUndefined();
		expect(result.warning).toContain('VITE_GOOGLE_MAPS_EMBED_API_KEY');
	});

	it('converts Google Maps place URLs when a Maps embed API key is configured', () => {
		vi.stubEnv('VITE_GOOGLE_MAPS_EMBED_API_KEY', 'maps-test-key');

		const result = enhanceUrl(
			'https://www.google.com/maps/place/UBC+Sauder+School+of+Business/@49.2648221,-123.2743907,14z',
		);

		expect(result.embedUrl).toBe(
			'https://www.google.com/maps/embed/v1/place?key=maps-test-key&q=UBC%20Sauder%20School%20of%20Business',
		);
	});

	it('builds a Microlink screenshot request for preview fallbacks', () => {
		expect(getMicrolinkApiUrl('https://example.com/article')).toBe(
			'https://api.microlink.io/?url=https%3A%2F%2Fexample.com%2Farticle&screenshot=true',
		);
	});
});
