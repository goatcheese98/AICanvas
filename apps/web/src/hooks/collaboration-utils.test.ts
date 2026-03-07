import { describe, expect, it } from 'vitest';
import {
	buildRoomHash,
	buildRoomLink,
	getCollaborationStatusCopy,
	getReconnectDelayMs,
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

	it('builds reconnect delays with exponential backoff and a cap', () => {
		expect(getReconnectDelayMs(0, 1000, 30000)).toBe(1000);
		expect(getReconnectDelayMs(1, 1000, 30000)).toBe(1000);
		expect(getReconnectDelayMs(2, 1000, 30000)).toBe(2000);
		expect(getReconnectDelayMs(6, 1000, 30000)).toBe(30000);
	});

	it('formats collaboration session status copy', () => {
		expect(getCollaborationStatusCopy('idle', 0)).toEqual({
			label: 'Not connected',
			detail: '0 collaborators connected',
		});
		expect(getCollaborationStatusCopy('connected', 2)).toEqual({
			label: 'Live',
			detail: '2 collaborators connected',
		});
		expect(getCollaborationStatusCopy('reconnecting', 1, 'Trying again')).toEqual({
			label: 'Reconnecting',
			detail: 'Trying again',
		});
		expect(getCollaborationStatusCopy('error', 0, 'Bad room link')).toEqual({
			label: 'Connection error',
			detail: 'Bad room link',
		});
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
