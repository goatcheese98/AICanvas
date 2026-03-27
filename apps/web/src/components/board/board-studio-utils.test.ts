import { describe, expect, it } from 'vitest';
import { getBoardStudioPath } from './board-studio-utils';

describe('board-studio-utils', () => {
	it('builds the focused board route path', () => {
		expect(getBoardStudioPath('canvas-1', 'board-1')).toBe('/canvas/canvas-1/board/board-1');
	});
});
