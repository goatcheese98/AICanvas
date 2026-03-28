import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { getDocumentStudioPath, getOpenDocumentElements } from './document-studio-utils';

describe('document-studio-utils', () => {
	it('builds the focused document route path', () => {
		expect(getDocumentStudioPath('canvas-1', 'document-1')).toBe(
			'/canvas/canvas-1/document/document-1',
		);
	});

	it('filters deleted documents out of the focused document list', () => {
		expect(
			getOpenDocumentElements([
				{
					id: 'document-live',
					type: 'rectangle',
					isDeleted: false,
					customData: { type: 'newlex' },
				} as unknown as ExcalidrawElement,
				{
					id: 'document-deleted',
					type: 'rectangle',
					isDeleted: true,
					customData: { type: 'newlex' },
				} as unknown as ExcalidrawElement,
				{
					id: 'board-1',
					type: 'rectangle',
					isDeleted: false,
					customData: { type: 'kanban' },
				} as unknown as ExcalidrawElement,
			]).map((element) => element.id),
		).toEqual(['document-live']);
	});
});
