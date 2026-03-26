import { describe, expect, it, vi } from 'vitest';
import {
	type CollaboratorState,
	LAST_COLOR_INDEX_KEY,
	applyCursorBroadcastPayload,
	buildCursorBroadcastPayload,
	buildSceneBroadcastPayload,
	getSessionCollaboratorColor,
	pruneCollaboratorsBySocketIds,
} from './collaboration-session';

describe('collaboration-session', () => {
	it('collects only valid scene files once', () => {
		const sentFileIds = new Set<string>(['already-sent']);
		const payload = buildSceneBroadcastPayload(
			[],
			{
				'already-sent': { dataURL: 'ignored', mimeType: 'image/png', created: 1 },
				'image-a': { dataURL: 'data:image/png;base64,a', mimeType: 'image/png' },
				'broken-b': { mimeType: 'image/png' },
			},
			sentFileIds,
		);

		expect(payload.type).toBe('scene-update');
		expect(payload.files).toMatchObject({
			'image-a': expect.objectContaining({
				id: 'image-a',
				mimeType: 'image/png',
				dataURL: 'data:image/png;base64,a',
			}),
		});
		expect(sentFileIds.has('image-a')).toBe(true);
		expect(sentFileIds.has('already-sent')).toBe(true);
		expect(sentFileIds.has('broken-b')).toBe(false);
	});

	it('builds cursor payloads and updates collaborators from them', () => {
		const payload = buildCursorBroadcastPayload(
			'client-1',
			{ x: 10, y: 20 },
			'down',
			{ a: true },
			'Rohan',
			{ background: '#fff', stroke: '#000' },
		);

		expect(payload).toEqual({
			type: 'cursor-update',
			clientId: 'client-1',
			pointer: { x: 10, y: 20 },
			button: 'down',
			selectedElementIds: { a: true },
			username: 'Rohan',
			color: { background: '#fff', stroke: '#000' },
		});

		const next = applyCursorBroadcastPayload(new Map(), payload);
		expect(next.get('client-1')).toEqual({
			pointer: { x: 10, y: 20 },
			button: 'down',
			selectedElementIds: { a: true },
			username: 'Rohan',
			color: { background: '#fff', stroke: '#000' },
			id: 'client-1',
		});
	});

	it('prunes collaborators to active socket ids', () => {
		const current = new Map<string, CollaboratorState>([
			['a', { username: 'A' }],
			['b', { username: 'B' }],
		]);

		expect(pruneCollaboratorsBySocketIds(current, ['b'])).toEqual(
			new Map<string, CollaboratorState>([['b', { username: 'B' }]]),
		);
	});

	it('avoids reusing the last collaborator color index when possible', () => {
		const random = vi.spyOn(Math, 'random').mockReturnValue(0);
		const storage = new Map<string, string>();
		vi.stubGlobal('window', {
			localStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => {
					storage.set(key, value);
				},
				removeItem: (key: string) => {
					storage.delete(key);
				},
				clear: () => {
					storage.clear();
				},
			},
		});

		try {
			storage.set(LAST_COLOR_INDEX_KEY, '0');

			const color = getSessionCollaboratorColor();

			expect(color).toEqual({ background: '#ffd8a8', stroke: '#e67700' });
			expect(storage.get(LAST_COLOR_INDEX_KEY)).toBe('1');
		} finally {
			random.mockRestore();
			vi.unstubAllGlobals();
		}
	});
});
