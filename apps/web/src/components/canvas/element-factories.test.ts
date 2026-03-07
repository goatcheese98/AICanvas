import { describe, expect, it, vi } from 'vitest';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { createOverlayCustomData, getOverlayDefaults } from './element-factories';

describe('element-factories', () => {
	it('creates markdown defaults', () => {
		const data = createOverlayCustomData({
			type: 'markdown',
			x: 0,
			y: 0,
		});

		expect(data).toMatchObject({
			type: 'markdown',
			content: '# New Note\n\nStart writing...',
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
			bgTheme: 'parchment',
			fontId: 'outfit',
			fontSize: 13,
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

	it('returns expected overlay defaults', () => {
		expect(getOverlayDefaults('markdown')).toEqual({ width: 400, height: 300 });
		expect(getOverlayDefaults('newlex')).toEqual({ width: 500, height: 400 });
		expect(getOverlayDefaults('kanban')).toEqual({ width: 700, height: 500 });
		expect(getOverlayDefaults('web-embed')).toEqual({ width: 640, height: 480 });
	});
});
