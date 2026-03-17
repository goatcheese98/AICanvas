import { describe, expect, it } from 'vitest';
import {
	normalizePrototypeStudioFilePath,
	validatePrototypeStudioFilePath,
} from './prototype-file-utils';

describe('prototype-file-utils', () => {
	it('normalizes common file path input into rooted prototype paths', () => {
		expect(normalizePrototypeStudioFilePath('components/Card.jsx')).toBe('/components/Card.jsx');
		expect(normalizePrototypeStudioFilePath('  \\styles.css  ')).toBe('/styles.css');
		expect(normalizePrototypeStudioFilePath('/src//lib//helpers.ts')).toBe('/src/lib/helpers.ts');
	});

	it('validates create and rename paths with workflow-friendly messages', () => {
		expect(
			validatePrototypeStudioFilePath({
				value: '',
				existingPaths: ['/App.jsx'],
			}),
		).toBe('Enter a file name.');

		expect(
			validatePrototypeStudioFilePath({
				value: '../secrets.js',
				existingPaths: ['/App.jsx'],
			}),
		).toBe('Use a path inside this prototype project.');

		expect(
			validatePrototypeStudioFilePath({
				value: 'components/card',
				existingPaths: ['/App.jsx'],
			}),
		).toBe('Include a file extension like .jsx, .css, or .json.');

		expect(
			validatePrototypeStudioFilePath({
				value: 'App.jsx',
				existingPaths: ['/App.jsx'],
			}),
		).toBe('A file with that name already exists.');

		expect(
			validatePrototypeStudioFilePath({
				value: 'App.jsx',
				existingPaths: ['/App.jsx'],
				currentPath: '/App.jsx',
			}),
		).toBeNull();
	});
});
