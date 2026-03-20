import { captureBrowserException } from '@/lib/observability';
import type { ClientToServerMessage } from '@ai-canvas/shared/types';
import { useCallback, useRef, useState } from 'react';
import {
	getPartykitHost,
	getPartykitWebSocketUrl,
	getReconnectDelayMs,
} from './collaboration-utils';
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS } from './collaboration-session';

export type WebSocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface CollabWebSocket {
	connect: (roomId: string) => void;
	disconnect: () => void;
	send: (message: ClientToServerMessage) => boolean;
	ws: WebSocket | null;
	status: WebSocketStatus;
	error: string | null;
	roomIdRef: { current: string | null };
	reconnectAttemptRef: { current: number };
}

interface WebSocketCallbacks {
	onOpen: () => void;
	onMessage: (event: MessageEvent) => void;
	onError: () => void;
	onClose: () => void;
}

export function useCollabWebSocket(callbacks: WebSocketCallbacks): CollabWebSocket {
	const [status, setStatus] = useState<WebSocketStatus>('idle');
	const [error, setError] = useState<string | null>(null);
	const [ws, setWs] = useState<WebSocket | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const roomIdRef = useRef<string | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptRef = useRef(0);

	const clearReconnectTimer = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
	}, []);

	const disconnect = useCallback(() => {
		clearReconnectTimer();
		reconnectAttemptRef.current = 0;
		roomIdRef.current = null;

		if (wsRef.current) {
			wsRef.current.onclose = null;
			wsRef.current.close();
			wsRef.current = null;
			setWs(null);
		}
	}, [clearReconnectTimer]);

	const send = useCallback((message: ClientToServerMessage): boolean => {
		const socket = wsRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) return false;
		try {
			socket.send(JSON.stringify(message));
			return true;
		} catch (error) {
			captureBrowserException(error, {
				tags: { area: 'collaboration', action: 'websocket_send' },
			});
			return false;
		}
	}, []);

	const connectInternal = useCallback(
		(roomId: string, isReconnect: boolean) => {
			if (wsRef.current) {
				wsRef.current.onclose = null;
				wsRef.current.close();
			}
			clearReconnectTimer();

			roomIdRef.current = roomId;

			if (!isReconnect) {
				reconnectAttemptRef.current = 0;
			}

			setError(null);
			setStatus(isReconnect ? 'reconnecting' : 'connecting');

			const host = getPartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
			const socket = new WebSocket(getPartykitWebSocketUrl(roomId, host));
			wsRef.current = socket;
			setWs(socket);

			socket.onopen = () => {
				reconnectAttemptRef.current = 0;
				setStatus('connected');
				setError(null);
				callbacks.onOpen();
			};

			socket.onmessage = (event) => {
				callbacks.onMessage(event);
			};

			socket.onerror = () => {
				if (reconnectAttemptRef.current === 0) {
					setStatus('error');
				}
				setError('Could not reach the collaboration server.');
				callbacks.onError();
			};

			socket.onclose = () => {
				if (!roomIdRef.current) return;
				const nextAttempt = reconnectAttemptRef.current + 1;
				reconnectAttemptRef.current = nextAttempt;
				const delay = getReconnectDelayMs(nextAttempt, RECONNECT_BASE_MS, RECONNECT_MAX_MS);
				setStatus('reconnecting');
				setError('Connection dropped. Trying to restore the room.');
				reconnectTimerRef.current = setTimeout(() => {
					if (roomIdRef.current) {
						connectInternal(roomIdRef.current, true);
					}
				}, delay);
			};
		},
		[callbacks, clearReconnectTimer],
	);

	const connect = useCallback(
		(roomId: string) => {
			connectInternal(roomId, false);
		},
		[connectInternal],
	);

	return {
		connect,
		disconnect,
		send,
		ws,
		status,
		error,
		roomIdRef,
		reconnectAttemptRef,
	};
}
