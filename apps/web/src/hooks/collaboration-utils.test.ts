import { describe, expect, it } from 'vitest';
import {
	buildRoomHash,
	buildRoomLink,
	getPartykitWebSocketUrl,
	parseRoomHash,
	readStoredUsername,
	sanitizePersistedCanvasAppState,
} from './collaboration-utils';

describe('collaboration-utils', () => {
	it('reads stored usernames with a fallback', () => {
		expect(readStoredUsername({ getItem: () => 'Rohan' })).toBe('Rohan');
		expect(readStoredUsername({ getItem: () => null })).toBe('Anonymous');
		expect(readStoredUsername(null)).toBe('Anonymous');
	});

	it('builds and parses room hashes', () => {
		const hash = buildRoomHash('room-1', 'secret-key');
		expect(hash).toBe('#room=room-1,secret-key');
		expect(parseRoomHash(hash)).toEqual({ roomId: 'room-1', keyBase64: 'secret-key' });
		expect(parseRoomHash('#bad')).toBeNull();
	});

	it('builds share links and websocket urls', () => {
		expect(buildRoomLink('https://app.test/canvas/1', 'room-1', 'secret')).toBe(
			'https://app.test/canvas/1#room=room-1,secret',
		);
		expect(getPartykitWebSocketUrl('room-1', 'localhost:1999', false)).toBe(
			'ws://localhost:1999/parties/main/room-1',
		);
		expect(getPartykitWebSocketUrl('room-1', 'example.com', true)).toBe(
			'wss://example.com/parties/main/room-1',
		);
	});

	it('sanitizes collaboration-only app state before persistence', () => {
		expect(
			sanitizePersistedCanvasAppState({
				scrollX: 1,
				scrollY: 2,
				width: 1440,
				height: 900,
				offsetLeft: 20,
				offsetTop: 10,
				selectedElementIds: { a: true },
				collaborators: new Map(),
			}),
		).toEqual({
			scrollX: 1,
			scrollY: 2,
		});
	});
});
