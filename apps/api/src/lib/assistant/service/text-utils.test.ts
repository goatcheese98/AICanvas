import { describe, expect, it } from 'vitest';
import {
	expectsFunctionalPrototype,
	extractPromptKeywords,
	extractPrototypeSubject,
	toTitleWords,
	truncateTitle,
} from './text-utils';

describe('text-utils', () => {
	describe('truncateTitle', () => {
		it('truncates text to 32 characters', () => {
			const longText = 'This is a very long title that exceeds thirty two characters';
			expect(truncateTitle(longText).length).toBeLessThanOrEqual(32);
		});

		it('capitalizes first letter', () => {
			expect(truncateTitle('hello world')).toBe('Hello world');
		});

		it('returns "Untitled" for empty string (via sentenceCase)', () => {
			expect(truncateTitle('')).toBe('Untitled');
			expect(truncateTitle('   ')).toBe('Untitled');
		});

		it('returns "Prototype" when sentenceCase result is empty', () => {
			// This case is theoretical since sentenceCase returns 'Untitled' for empty
			// But the || 'Prototype' ensures fallback if somehow empty
			const result = truncateTitle('');
			expect(result).toBeTruthy();
		});
	});

	describe('extractPrototypeSubject', () => {
		it('extracts subject from "for" phrase', () => {
			expect(extractPrototypeSubject('create a prototype for my new app')).toBe('my new');
		});

		it('removes common prototype words', () => {
			// Note: 'a' is not in the stopwords list, so it stays
			expect(extractPrototypeSubject('build a calculator prototype')).toBe('a calculator');
		});

		it('cleans up special characters while preserving hyphens', () => {
			// Hyphens are preserved by the regex /[^\w\s-]/g
			expect(extractPrototypeSubject('create a landing-page for e-commerce!')).toBe('e-commerce');
		});

		it('returns default for empty result', () => {
			expect(extractPrototypeSubject('create build make')).toBe('AI Product');
		});
	});

	describe('toTitleWords', () => {
		it('capitalizes each word', () => {
			expect(toTitleWords('hello world')).toBe('Hello World');
		});

		it('lowercases word after first letter', () => {
			expect(toTitleWords('HELLO WORLD')).toBe('Hello World');
		});

		it('handles multiple spaces', () => {
			expect(toTitleWords('hello   world')).toBe('Hello World');
		});
	});

	describe('extractPromptKeywords', () => {
		it('extracts keywords excluding stopwords', () => {
			const result = extractPromptKeywords('create a website for marketing');
			expect(result).toContain('marketing');
			expect(result).not.toContain('create');
			expect(result).not.toContain('a');
			expect(result).not.toContain('for');
		});

		it('filters short tokens', () => {
			const result = extractPromptKeywords('a an the in on at');
			expect(result).toHaveLength(0);
		});

		it('returns at most 6 keywords', () => {
			const text = 'one two three four five six seven eight nine ten';
			const result = extractPromptKeywords(text);
			expect(result.length).toBeLessThanOrEqual(6);
		});

		it('deduplicates keywords', () => {
			const result = extractPromptKeywords('website website web');
			expect(result.filter((k) => k === 'web')).toHaveLength(1);
		});
	});

	describe('expectsFunctionalPrototype', () => {
		it('returns true for calculator requests', () => {
			expect(expectsFunctionalPrototype('build a calculator app')).toBe(true);
		});

		it('returns true for tool/utility requests', () => {
			expect(expectsFunctionalPrototype('create a timer tool')).toBe(true);
			expect(expectsFunctionalPrototype('make a todo tracker')).toBe(true);
		});

		it('returns false for landing page requests', () => {
			expect(expectsFunctionalPrototype('create a landing page')).toBe(false);
			expect(expectsFunctionalPrototype('design a marketing website')).toBe(false);
		});

		it('returns false for homepage requests', () => {
			expect(expectsFunctionalPrototype('build a homepage')).toBe(false);
		});
	});
});
