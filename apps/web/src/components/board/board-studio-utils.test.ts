import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { getBoardStudioPath, getOpenBoardElements } from './board-studio-utils';

describe('board-studio-utils', () => {
	it('builds the focused board route path', () => {
		expect(getBoardStudioPath('canvas-1', 'board-1')).toBe('/canvas/canvas-1/board/board-1');
	});

	it('filters deleted boards out of the focused board list', () => {
		expect(
			getOpenBoardElements([
				{
					id: 'board-live',
					type: 'rectangle',
					isDeleted: false,
					customData: { type: 'kanban' },
				} as unknown as ExcalidrawElement,
				{
					id: 'board-deleted',
					type: 'rectangle',
					isDeleted: true,
					customData: { type: 'kanban' },
				} as unknown as ExcalidrawElement,
				{
					id: 'note-1',
					type: 'rectangle',
					isDeleted: false,
					customData: { type: 'markdown' },
				} as unknown as ExcalidrawElement,
			]).map((element) => element.id),
		).toEqual(['board-live']);
	});
});
