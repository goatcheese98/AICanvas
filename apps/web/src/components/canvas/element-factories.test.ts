import type { KanbanOverlayCustomData, PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import { describe, expect, it, vi } from 'vitest';
import {
	buildOverlayInsertionScene,
	createOverlayCustomData,
	getOverlayDefaults,
} from './element-factories';

const DEFAULT_MARKDOWN_CONTENT = `# <img src="https://cdn.jsdelivr.net/gh/dcurtis/markdown-mark/svg/markdown-mark.svg" alt="Markdown icon" width="28" height="28" /> New Note

Double-click to edit this note.

## Bullet List
- First list item
- Second list item

## Checklist
- [ ] Draft the content
- [x] Review the layout

## Code Example
\`\`\`javascript
const example = "Hello World";
console.log(example);
\`\`\`

## Links Table
| Resource | Link |
| -------- | ---- |
| Markdown Guide | [CommonMark](https://commonmark.org/) |
| GFM Spec | [GitHub Flavored Markdown](https://github.github.com/gfm/) |

> Tip: switch between Raw, Hybrid, and Preview to explore the note.`;

describe('element-factories', () => {
	it('creates markdown defaults', () => {
		const data = createOverlayCustomData({
			type: 'markdown',
			x: 0,
			y: 0,
		});

		expect(data).toMatchObject({
			type: 'markdown',
			title: 'Markdown',
			content: DEFAULT_MARKDOWN_CONTENT,
			settings: {
				fontSize: 8,
			},
		});
	});

	it('creates newlex defaults', () => {
		const data = createOverlayCustomData({
			type: 'newlex',
			x: 0,
			y: 0,
		});

		expect(data).toMatchObject({
			type: 'newlex',
			title: 'Rich Text',
			lexicalState: '',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
		});
	});

	it('creates kanban defaults with three columns', () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
			.mockReturnValueOnce('22222222-2222-2222-2222-222222222222')
			.mockReturnValueOnce('33333333-3333-3333-3333-333333333333');

		const data = createOverlayCustomData({
			type: 'kanban',
			x: 0,
			y: 0,
		}) as KanbanOverlayCustomData;

		expect(data).toMatchObject({
			type: 'kanban',
			title: 'Kanban Board',
		});
		expect(data.columns).toHaveLength(3);
		expect(data.columns.map((column) => column.title)).toEqual(['To Do', 'In Progress', 'Done']);
	});

	it('creates web embed defaults', () => {
		const data = createOverlayCustomData({
			type: 'web-embed',
			x: 0,
			y: 0,
		});

		expect(data).toEqual({
			type: 'web-embed',
			url: '',
		});
	});

	it('creates prototype defaults', () => {
		const data = createOverlayCustomData({
			type: 'prototype',
			x: 0,
			y: 0,
		});

		expect(data).toMatchObject({
			type: 'prototype',
			title: 'Prototype',
			template: 'react',
			preview: {
				eyebrow: 'PulseBoard',
				title: 'Prototype',
			},
			activeFile: '/App.jsx',
			showEditor: true,
			showPreview: true,
			dependencies: {},
		});
		const prototypeData = data as PrototypeOverlayCustomData;
		expect(prototypeData.files['/App.jsx']).toBeDefined();
	});

	it('returns expected overlay defaults', () => {
		expect(getOverlayDefaults('markdown')).toEqual({ width: 400, height: 450 });
		expect(getOverlayDefaults('newlex')).toEqual({ width: 500, height: 400 });
		expect(getOverlayDefaults('kanban')).toEqual({ width: 1050, height: 900 });
		expect(getOverlayDefaults('web-embed')).toEqual({ width: 640, height: 480 });
		expect(getOverlayDefaults('prototype')).toEqual({ width: 720, height: 520 });
	});

	it('builds an insertion scene that appends and selects the new overlay', () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'11111111-1111-1111-1111-111111111111',
		);

		const result = buildOverlayInsertionScene(
			'markdown',
			[
				{
					id: 'existing-1',
					type: 'rectangle',
					x: 0,
					y: 0,
					width: 10,
					height: 10,
				} as unknown as ExcalidrawElement,
			],
			{
				scrollX: -100,
				scrollY: -50,
				width: 1000,
				height: 800,
				zoom: { value: 2 } as AppState['zoom'],
			},
		);

		expect(result.insertedElementId).toBe('11111111-1111-1111-1111-111111111111');
		expect(result.elements).toHaveLength(2);
		expect(result.elements[1]).toMatchObject({
			id: '11111111-1111-1111-1111-111111111111',
			x: 150,
			y: 25,
			width: 400,
			height: 450,
		});
		expect(result.appState).toEqual({
			selectedElementIds: { '11111111-1111-1111-1111-111111111111': true },
		});
	});
});
