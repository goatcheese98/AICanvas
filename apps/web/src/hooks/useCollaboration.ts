import { useMountEffect } from '@/hooks/useMountEffect';
import {
	decryptData,
	encryptData,
	exportKey,
	generateEncryptionKey,
	importKey,
} from '@/lib/collab/encryption';
import { captureBrowserException } from '@/lib/observability';
import { useAppStore } from '@/stores/store';
import type { ClientToServerMessage } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import { useCallback, useRef, useState } from 'react';
import {
	buildRoomHash,
	buildRoomLink,
	getPartykitHost,
	getPartykitWebSocketUrl,
	getReconnectDelayMs,
	getSelectedElementIds,
	parseRoomHash,
	readStoredUsername,
} from './collaboration-utils';
import { processCollaborationServerMessage } from './collaboration-messages';
import {
	applyCollaboratorsSnapshot,
	buildCursorBroadcastPayload,
	buildSceneBroadcastPayload,
	createId,
	getSessionCollaboratorColor,
	type CollaborationApi,
	type CollaboratorColor,
	type CollaboratorState,
	type CollabFile,
	type RemoteElement,
	CURSOR_THROTTLE_MS,
	RECONNECT_BASE_MS,
	RECONNECT_MAX_MS,
	SCENE_THROTTLE_MS,
} from './collaboration-session';
import { applyRemoteSceneUpdate } from './collaboration-remote-scene';
import { useThrottledCallback } from './useThrottledCallback';

type CollaborationOptions = {
	onError?: (message: string) => void;
};

interface PendingScene {
	elements: RemoteElement[];
	files?: Record<string, CollabFile>;
}

function createCollaboratorState(): Map<string, CollaboratorState> {
	return new Map();
}

export function useCollaboration({ onError }: CollaborationOptions = {}) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi) as CollaborationApi | null;
	const setAppState = useAppStore((s) => s.setAppState);
	const [isCollaborating, setIsCollaborating] = useState(false);
	const [roomLink, setRoomLink] = useState<string | null>(null);
	const [username, setUsernameState] = useState(() =>
		typeof window === 'undefined' ? 'Anonymous' : readStoredUsername(window.localStorage),
	);
	const [collaborators, setCollaborators] = useState<Map<string, CollaboratorState>>(
		createCollaboratorState(),
	);
	const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
	const [sessionError, setSessionError] = useState<string | null>(null);

	const apiRef = useRef<CollaborationApi | null>(excalidrawApi);
	apiRef.current = excalidrawApi;
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;
	const isCollaboratingRef = useRef(false);
	const wsRef = useRef<WebSocket | null>(null);
	const encKeyRef = useRef<CryptoKey | null>(null);
	const keyBase64Ref = useRef<string | null>(null);
	const roomIdRef = useRef<string | null>(null);
	const clientIdRef = useRef(createId());
	const collaboratorColorRef = useRef<CollaboratorColor>(getSessionCollaboratorColor());
	const collaboratorsRef = useRef<Map<string, CollaboratorState>>(createCollaboratorState());
	const sentFileIdsRef = useRef<Set<string>>(new Set());
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptRef = useRef(0);
	const isApplyingRemoteRef = useRef(false);
	const pendingSceneRef = useRef<PendingScene | null>(null);

	const setUsername = useCallback((name: string) => {
		setUsernameState(name);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('excalidraw_name', name);
		}
	}, []);

	const applyCollaborators = useCallback(
		(next: Map<string, CollaboratorState>) => {
			collaboratorsRef.current = next;
			applyCollaboratorsSnapshot(apiRef.current, setCollaborators, setAppState, next);
		},
		[setAppState],
	);

	const applyRemoteScene = useCallback(
		(targetApi: CollaborationApi, elements: RemoteElement[], files?: Record<string, CollabFile>) => {
			applyRemoteSceneUpdate(
				targetApi,
				elements,
				files,
				sentFileIdsRef.current,
				isApplyingRemoteRef,
			);
		},
		[],
	);

	const broadcastSceneRaw = useCallback(
		async (
			elements: readonly ExcalidrawElement[],
			files: Record<string, unknown> | null,
			volatile: boolean,
		) => {
			const ws = wsRef.current;
			const key = encKeyRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN || !key) return;

			const payload = buildSceneBroadcastPayload(elements, files, sentFileIdsRef.current);

			try {
				const encrypted = await encryptData(JSON.stringify(payload), key);
				const msgType: ClientToServerMessage['type'] = volatile
					? 'server-volatile-broadcast'
					: 'server-broadcast';
				ws.send(JSON.stringify({ type: msgType, ...encrypted }));
			} catch (error) {
				console.error('[Collab] Encrypt/send failed:', error);
				captureBrowserException(error, {
					tags: {
						area: 'collaboration',
						action: 'encrypt_send_scene',
					},
					extra: {
						roomId: roomIdRef.current,
					},
				});
			}
		},
		[],
	);

	const broadcastCursorRaw = useCallback(
		async (
			pointer: { x: number; y: number },
			button: 'down' | 'up',
			selectedElementIds: Record<string, boolean>,
		) => {
			const ws = wsRef.current;
			const key = encKeyRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN || !key) return;

			const payload = buildCursorBroadcastPayload(
				clientIdRef.current,
				pointer,
				button,
				selectedElementIds,
				username,
				collaboratorColorRef.current,
			);

			try {
				const encrypted = await encryptData(JSON.stringify(payload), key);
				ws.send(JSON.stringify({ type: 'server-volatile-broadcast', ...encrypted }));
			} catch {
				// ignore cursor send failures
			}
		},
		[username],
	);

	const broadcastSceneThrottled = useThrottledCallback(
		(elements: readonly ExcalidrawElement[], files: Record<string, unknown> | null) => {
			void broadcastSceneRaw(elements, files, false);
		},
		SCENE_THROTTLE_MS,
	);

	const broadcastCursorThrottled = useThrottledCallback(broadcastCursorRaw, CURSOR_THROTTLE_MS);

	const handleMessage = useCallback(
		(event: MessageEvent) =>
			processCollaborationServerMessage(event, {
				getApi: () => apiRef.current,
				getKey: () => encKeyRef.current,
				getRoomId: () => roomIdRef.current,
				collaboratorsRef,
				pendingSceneRef,
				broadcastSceneRaw,
				applyCollaborators,
				applyRemoteScene,
			}),
		[applyCollaborators, applyRemoteScene, broadcastSceneRaw],
	);

	const connect = useCallback(
		(roomId: string, key: CryptoKey, keyBase64: string) => {
			const isReconnect =
				roomIdRef.current === roomId &&
				keyBase64Ref.current === keyBase64 &&
				reconnectAttemptRef.current > 0;

			if (wsRef.current) {
				wsRef.current.onclose = null;
				wsRef.current.close();
			}
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}

			encKeyRef.current = key;
			keyBase64Ref.current = keyBase64;
			roomIdRef.current = roomId;
			if (!isReconnect) {
				collaboratorsRef.current = createCollaboratorState();
				setCollaborators(createCollaboratorState());
				reconnectAttemptRef.current = 0;
			}
			setSessionError(null);
			setSessionStatus(isReconnect ? 'reconnecting' : 'connecting');

			const host = getPartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
			const ws = new WebSocket(getPartykitWebSocketUrl(roomId, host));
			wsRef.current = ws;

			ws.onopen = () => {
				reconnectAttemptRef.current = 0;
				isCollaboratingRef.current = true;
				setIsCollaborating(true);
				setSessionStatus('connected');
				setSessionError(null);
				const baseUrl =
					typeof window !== 'undefined'
						? `${window.location.origin}${window.location.pathname}${window.location.search}`
						: '';
				setRoomLink(buildRoomLink(baseUrl, roomId, keyBase64));
			};

			ws.onmessage = (event) => {
				void handleMessage(event);
			};

			ws.onerror = () => {
				if (reconnectAttemptRef.current === 0) {
					setSessionStatus('error');
				}
				setSessionError('Could not reach the collaboration server.');
			};

			ws.onclose = () => {
				if (!encKeyRef.current) return;
				const nextAttempt = reconnectAttemptRef.current + 1;
				reconnectAttemptRef.current = nextAttempt;
				const delay = getReconnectDelayMs(nextAttempt, RECONNECT_BASE_MS, RECONNECT_MAX_MS);
				setSessionStatus('reconnecting');
				setSessionError('Connection dropped. Trying to restore the room.');
				reconnectTimerRef.current = setTimeout(() => {
					if (encKeyRef.current && roomIdRef.current && keyBase64Ref.current) {
						connect(roomIdRef.current, encKeyRef.current, keyBase64Ref.current);
					}
				}, delay);
			};
		},
		[handleMessage],
	);

	const startSession = useCallback(async () => {
		setSessionStatus('connecting');
		setSessionError(null);
		const roomId = createId();
		const key = await generateEncryptionKey();
		const keyBase64 = await exportKey(key);
		sentFileIdsRef.current = new Set();

		if (typeof window !== 'undefined') {
			const hash = buildRoomHash(roomId, keyBase64);
			window.history.pushState(
				null,
				'',
				`${window.location.pathname}${window.location.search}${hash}`,
			);
		}

		connect(roomId, key, keyBase64);
	}, [connect]);

	const stopSession = useCallback(() => {
		encKeyRef.current = null;
		keyBase64Ref.current = null;
		roomIdRef.current = null;
		isCollaboratingRef.current = false;
		reconnectAttemptRef.current = 0;

		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}

		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}

		applyCollaborators(createCollaboratorState());
		setRoomLink(null);
		setIsCollaborating(false);
		setSessionStatus('idle');
		setSessionError(null);

		if (typeof window !== 'undefined') {
			window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
		}
	}, [applyCollaborators]);

	const handleSceneChange = useCallback(
		(elements: readonly ExcalidrawElement[], _appState: unknown, files: unknown) => {
			if (!isCollaboratingRef.current || isApplyingRemoteRef.current) return;
			broadcastSceneThrottled(elements, files as Record<string, unknown> | null);
		},
		[broadcastSceneThrottled],
	);

	const handlePointerUpdate = useCallback(
		(payload: {
			pointer: { x: number; y: number };
			button: 'down' | 'up';
			pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
		}) => {
			if (!isCollaboratingRef.current) return;
			const appState = apiRef.current?.getAppState();
			broadcastCursorThrottled(
				payload.pointer,
				payload.button,
				getSelectedElementIds((appState ?? {}) as Partial<AppState>),
			);
		},
		[broadcastCursorThrottled],
	);

	// Sync pending scene when excalidrawApi becomes available
	// Using ref-based pattern to avoid useEffect dependency issues
	const lastSyncedApiRef = useRef<typeof excalidrawApi>(null);
	if (excalidrawApi && lastSyncedApiRef.current !== excalidrawApi && isCollaboratingRef.current) {
		lastSyncedApiRef.current = excalidrawApi;

		const pending = pendingSceneRef.current;
		if (pending) {
			pendingSceneRef.current = null;
			applyRemoteScene(excalidrawApi, pending.elements, pending.files);
		}

		const ws = wsRef.current;
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'resync-request' satisfies ClientToServerMessage['type'] }));
		}
	}

	const syncWithLocationHash = useCallback(() => {
		if (typeof window === 'undefined') return;
		const parsed = parseRoomHash(window.location.hash);

		if (!parsed) {
			if (roomIdRef.current || keyBase64Ref.current) {
				stopSession();
			}
			return;
		}

		if (parsed.roomId === roomIdRef.current && parsed.keyBase64 === keyBase64Ref.current) {
			return;
		}

		setSessionStatus('connecting');
		setSessionError(null);
		importKey(parsed.keyBase64)
			.then((key) => connect(parsed.roomId, key, parsed.keyBase64))
			.catch((error) => {
				captureBrowserException(error, {
					tags: {
						area: 'collaboration',
						action: 'import_room_key',
					},
					extra: {
						roomId: parsed.roomId,
					},
				});
				const message =
					'Could not join collaboration room — the link appears to be invalid or corrupted.';
				setSessionStatus('error');
				setSessionError(message);
				onErrorRef.current?.(message);
				window.history.replaceState(
					null,
					'',
					`${window.location.pathname}${window.location.search}`,
				);
			});
	}, [connect, stopSession]);

	// Hash change listener setup with cleanup
	useMountEffect(() => {
		syncWithLocationHash();
		window.addEventListener('hashchange', syncWithLocationHash);
		return () => {
			window.removeEventListener('hashchange', syncWithLocationHash);
		};
	});

	// Cleanup on unmount
	useMountEffect(() => {
		return () => {
			encKeyRef.current = null;
			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
			wsRef.current?.close();
		};
	});

	return {
		isCollaborating,
		collaborators,
		roomLink,
		sessionError,
		sessionStatus,
		username,
		setUsername,
		startSession,
		stopSession,
		handleSceneChange,
		handlePointerUpdate,
	};
}
