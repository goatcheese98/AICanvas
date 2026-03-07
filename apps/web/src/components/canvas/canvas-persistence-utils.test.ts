import { describe, expect, it } from 'vitest';
import {
	buildPersistedCanvasData,
	shouldWaitForCanvasHydration,
} from './canvas-persistence-utils';

describe('buildPersistedCanvasData', () => {
	it('drops volatile app state fields before persistence', () => {
		const data = buildPersistedCanvasData(
			[{ id: 'shape-1' }],
			{
				backgroundColor: '#ffffff',
				width: 1280,
				height: 720,
				selectedElementIds: { 'shape-1': true },
			},
			{ fileA: { id: 'fileA' } },
		);

		expect(data.elements).toEqual([{ id: 'shape-1' }]);
		expect(data.appState).toEqual({ backgroundColor: '#ffffff' });
		expect(data.files).toEqual({ fileA: { id: 'fileA' } });
	});
});

describe('shouldWaitForCanvasHydration', () => {
	it('waits while the initial request is pending', () => {
		expect(shouldWaitForCanvasHydration('pending', 'fetching')).toBe(true);
		expect(shouldWaitForCanvasHydration('pending', 'idle')).toBe(true);
	});

	it('waits for a refetch to settle before hydrating cached data', () => {
		expect(shouldWaitForCanvasHydration('success', 'fetching')).toBe(true);
		expect(shouldWaitForCanvasHydration('error', 'fetching')).toBe(true);
	});

	it('allows hydration once the request is settled', () => {
		expect(shouldWaitForCanvasHydration('success', 'idle')).toBe(false);
		expect(shouldWaitForCanvasHydration('error', 'idle')).toBe(false);
	});
});
