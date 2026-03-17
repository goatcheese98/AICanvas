import { describe, expect, it } from 'vitest';
import { filterAndSortCanvases, hasCanvasTitleConflict } from './dashboard-utils';

const canvases = [
	{
		id: '1',
		userId: 'u1',
		title: 'Zeta Board',
		description: 'planning',
		isPublic: false,
		r2Key: 'a',
		thumbnailUrl: undefined,
		isFavorite: false,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-03T00:00:00.000Z',
	},
	{
		id: '2',
		userId: 'u1',
		title: 'Alpha Board',
		description: 'research',
		isPublic: false,
		r2Key: 'b',
		thumbnailUrl: undefined,
		isFavorite: true,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-02T00:00:00.000Z',
	},
	{
		id: '3',
		userId: 'u1',
		title: 'Gamma Notes',
		description: 'Launch planning',
		isPublic: false,
		r2Key: 'c',
		thumbnailUrl: undefined,
		isFavorite: false,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-04T00:00:00.000Z',
	},
] as const;

describe('dashboard-utils', () => {
	it('sorts by recent by default', () => {
		expect(filterAndSortCanvases([...canvases], '', 'recent').map((canvas) => canvas.id)).toEqual([
			'3',
			'1',
			'2',
		]);
	});

	it('sorts alphabetically', () => {
		expect(
			filterAndSortCanvases([...canvases], '', 'alphabetical').map((canvas) => canvas.title),
		).toEqual(['Alpha Board', 'Gamma Notes', 'Zeta Board']);
	});

	it('promotes favorites when sorting by favorites', () => {
		expect(filterAndSortCanvases([...canvases], '', 'favorites')[0]?.id).toBe('2');
	});

	it('filters by title or description', () => {
		expect(
			filterAndSortCanvases([...canvases], 'launch', 'recent').map((canvas) => canvas.id),
		).toEqual(['3']);
		expect(
			filterAndSortCanvases([...canvases], 'alpha', 'recent').map((canvas) => canvas.id),
		).toEqual(['2']);
	});

	it('detects duplicate titles using normalized keys', () => {
		expect(hasCanvasTitleConflict([...canvases], '  alpha   board ')).toBe(true);
		expect(hasCanvasTitleConflict([...canvases], '  alpha   board ', '2')).toBe(false);
		expect(hasCanvasTitleConflict([...canvases], 'New Board')).toBe(false);
	});
});
