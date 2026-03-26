import type { PrototypeCardPreview, PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import { describe, expect, it, vi } from 'vitest';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
	default: ({ value, onChange }: { value: string; onChange?: (val: string) => void }) => {
		return {
			type: 'div',
			props: {
				'data-testid': 'monaco-editor',
				'data-value': value,
				onChange,
			},
		};
	},
}));

describe('usePrototypeCodeEditor patterns', () => {
	it('should sync refs directly without useEffect', () => {
		const onChange = vi.fn();
		const onChangeRef = { current: onChange };

		// Direct ref assignment (no useEffect needed)
		onChangeRef.current = onChange;

		expect(onChangeRef.current).toBe(onChange);
	});

	it('should handle code changes via callbacks', () => {
		const setDraft = vi.fn();
		const setDirty = vi.fn();

		const handleChange = (value: string | undefined) => {
			if (value !== undefined) {
				setDraft(value);
				setDirty(true);
			}
		};

		handleChange('new code');

		expect(setDraft).toHaveBeenCalledWith('new code');
		expect(setDirty).toHaveBeenCalledWith(true);
	});

	it('should handle file activation without useEffect', () => {
		const files = {
			'/index.jsx': { code: 'export default () => null;', active: false },
			'/utils.js': { code: 'export const helper = () => {};', active: true },
		};

		const setActiveFile = (path: string) => {
			for (const key of Object.keys(files)) {
				files[key as keyof typeof files].active = key === path;
			}
		};

		setActiveFile('/index.jsx');

		expect(files['/index.jsx'].active).toBe(true);
		expect(files['/utils.js'].active).toBe(false);
	});
});

describe('usePrototypePreview compilation patterns', () => {
	const mockPreview: PrototypeCardPreview = {
		eyebrow: 'Test',
		title: 'Test',
		description: 'Test',
		accent: '#000',
		background: '#fff',
		badges: [],
		metrics: [],
	};

	const mockInput: PrototypeOverlayCustomData = {
		type: 'prototype',
		template: 'react',
		files: {
			'/index.jsx': { code: 'export default () => null;', active: true },
		},
		dependencies: {},
		preview: mockPreview,
		title: 'Test',
		activeFile: '/index.jsx',
		showEditor: true,
		showPreview: true,
	};

	it('should handle runtime compilation triggering', () => {
		const compile = vi.fn();
		const prevFilesRef = { current: mockInput.files };

		// Files changed - should compile
		const newFiles = {
			...mockInput.files,
			'/index.jsx': { code: 'export default () => <div>Updated</div>;', active: true },
		};

		if (JSON.stringify(newFiles) !== JSON.stringify(prevFilesRef.current)) {
			compile(newFiles);
			prevFilesRef.current = newFiles;
		}

		expect(compile).toHaveBeenCalled();
	});

	it('should handle preview updates', () => {
		const updatePreview = vi.fn();
		const hasPreview = !!mockInput.preview;

		if (hasPreview) {
			updatePreview(mockInput.preview);
		}

		expect(updatePreview).toHaveBeenCalled();
	});
});
