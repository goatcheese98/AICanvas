import { describe, expect, it } from 'vitest';
import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import {
	applyPrototypeStudioCommand,
	applyPrototypeStudioCommands,
	listPrototypeFiles,
} from './prototype-control';

describe('prototype-control', () => {
	it('writes files and keeps active file state aligned', () => {
		const initial = normalizePrototypeOverlay({});
		const updated = applyPrototypeStudioCommand(initial, {
			type: 'write_file',
			path: '/App.jsx',
			code: "export default function App() { return <div>Updated</div>; }",
		});

		expect(updated.files['/App.jsx']?.code).toContain('Updated');
		expect(updated.activeFile).toBe('/App.jsx');
		expect(updated.files['/App.jsx']?.active).toBe(true);
	});

	it('renames visible files without losing focus', () => {
		const initial = normalizePrototypeOverlay({});
		const updated = applyPrototypeStudioCommands(initial, [
			{
				type: 'create_file',
				path: '/helpers.js',
				code: 'export const value = 1;',
				activate: true,
			},
			{
				type: 'rename_file',
				from: '/helpers.js',
				to: '/helpers.jsx',
			},
		]);

		expect(updated.files['/helpers.js']).toBeUndefined();
		expect(updated.files['/helpers.jsx']?.code).toContain('value = 1');
		expect(updated.activeFile).toBe('/helpers.jsx');
	});

	it('removes legacy runtime scaffolding during command normalization', () => {
		const updated = applyPrototypeStudioCommand(
			normalizePrototypeOverlay({
				files: {
					'/App.js': { code: "export default function App() { return <div>Hi</div>; }", active: true },
					'/index.html': { code: '<div id="root"></div>', hidden: true },
					'/package.json': { code: '{"name":"legacy"}', hidden: true },
				},
			}),
			{ type: 'set_title', title: 'Refined prototype' },
		);

		expect(updated.files['/App.jsx']?.code).toContain('Hi');
		expect(updated.files['/index.html']).toBeUndefined();
		expect(updated.files['/package.json']).toBeUndefined();
	});

	it('lists only visible files by default', () => {
		const initial = normalizePrototypeOverlay({});

		expect(listPrototypeFiles(initial)).toEqual(['/App.jsx', '/styles.css']);
		expect(listPrototypeFiles(initial, { includeHidden: true })).toContain('/index.jsx');
	});
});
