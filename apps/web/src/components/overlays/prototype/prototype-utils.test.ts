import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import { describe, expect, it } from 'vitest';
import { ensurePrototypeStarterFiles, getPrototypeStarterCode } from './prototype-utils';

describe('prototype-utils', () => {
	it('seeds a simple starter project when a prototype has no files', () => {
		const starter = ensurePrototypeStarterFiles(
			normalizePrototypeOverlay({
				template: 'react',
				files: {},
			}),
		);

		expect(Object.keys(starter.files).sort()).toEqual(['/index.jsx', '/styles.css']);
		expect(starter.activeFile).toBe('/index.jsx');
		expect(starter.files['/index.jsx']?.code).toContain('Welcome to your prototype');
		expect(starter.files['/styles.css']?.code).toContain('.prototype-demo');
	});

	it('returns starter code for newly added files', () => {
		expect(getPrototypeStarterCode('/components/Card.jsx', 'react')).toContain(
			'Add your component here',
		);
		expect(getPrototypeStarterCode('/utilities/helpers.js', 'vanilla')).toContain(
			'Add your logic here',
		);
		expect(getPrototypeStarterCode('/styles.css', 'react')).toContain('.prototype-demo');
	});
});
