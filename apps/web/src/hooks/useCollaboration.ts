import { useMountEffect } from '@/hooks/useMountEffect';
import { captureBrowserException } from '@/lib/observability';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { processCollaborationServerMessage } from './collaboration-messages';
import { applyRemoteSceneUpdate } from './collaboration-remote-scene';
import {
	type CollabFile,
	type CollaborationApi,
	type RemoteElement,
	createId,
} from './collaboration-session';
import {
	buildRoomHash,
	buildRoomLink,
	getSelectedElementIds,
	parseRoomHash,
	readStoredUsername,
} from './collaboration-utils';
import { useCollabBroadcast } from './useCollabBroadcast';
import { useCollabCollaborators } from './useCollabCollaborators';
import { useCollabEncryption } from './useCollabEncryption';
import { useCollabWebSocket } from './useCollabWebSocket';

export type { CollaboratorState, CollabFile, RemoteElement } from './collaboration-session';

export type CollaborationOptions = {
	onError?: (message: string) => void;
};

export type { CollaborationOptions as CollaborationOptionsType };

interface PendingScene {
	elements: RemoteElement[];
	files?: Record<string, CollabFile>;
}

export function useCollaboration({ onError }: CollaborationOptions = {}) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi) as CollaborationApi | null;
	const [isCollaborating, setIsCollaborating] = useState(false);
	const [roomLink, setRoomLink] = useState<string | null>(null);
	const [username, setUsernameState] = useState(() =>
		typeof window === 'undefined' ? 'Anonymous' : readStoredUsername(window.localStorage),
	);
	const [sessionStatus, setSessionStatus] = useState<
		'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
	>('idle');
	const [sessionError, setSessionError] = useState<string | null>(null);

	const apiRef = useRef<CollaborationApi | null>(excalidrawApi);
	apiRef.current = excalidrawApi;
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;
	const isCollaboratingRef = useRef(false);
	const keyBase64Ref = useRef<string | null>(null);
	const sentFileIdsRef = useRef<Set<string>>(new Set());
	const isApplyingRemoteRef = useRef(false);
	const pendingSceneRef = useRef<PendingScene | null>(null);

	// Sub-hooks
	const encryption = useCollabEncryption();
	const collaborators = useCollabCollaborators(apiRef);

	// Helper to check WebSocket connection
	const isConnected = useCallback(() => {
		return ws.status === 'connected';
	}, []);

	const broadcast = useCollabBroadcast({
		isConnected,
		encrypt: encryption.encrypt,
		send: (msg) => ws.send(msg),
		sentFileIdsRef,
	});

	// Message handler - defined before WebSocket to avoid circular dependency
	const handleMessage = useCallback(
		async (event: MessageEvent) => {
			await processCollaborationServerMessage(event, {
				getApi: () => apiRef.current,
				getKey: () => encryption.key,
				getRoomId: () => ws.roomIdRef.current,
				collaboratorsRef: collaborators.collaboratorsRef,
				pendingSceneRef,
				broadcastSceneRaw: broadcast.broadcastSceneRaw,
				applyCollaborators: collaborators.applyCollaborators,
				applyRemoteScene,
			});
		},
		[encryption.key, collaborators, broadcast.broadcastSceneRaw],
	);

	const ws = useCollabWebSocket({
		onOpen: () => {
			isCollaboratingRef.current = true;
			setIsCollaborating(true);
			setSessionStatus('connected');
			setSessionError(null);
			const baseUrl =
				typeof window !== 'undefined'
					? `${window.location.origin}${window.location.pathname}${window.location.search}`
					: '';
			if (ws.roomIdRef.current && keyBase64Ref.current) {
				setRoomLink(buildRoomLink(baseUrl, ws.roomIdRef.current, keyBase64Ref.current));
			}
		},
		onMessage: (event) => {
			void handleMessage(event);
		},
		onError: () => {
			setSessionError('Could not reach the collaboration server.');
		},
		onClose: () => {
			// Reconnect logic handled internally by useCollabWebSocket
		},
	});

	useEffect(() => {
		setSessionStatus(ws.status);
	}, [ws.status]);

	useEffect(() => {
		setSessionError(ws.error);
	}, [ws.error]);

	const setUsername = useCallback((name: string) => {
		setUsernameState(name);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('excalidraw_name', name);
		}
	}, []);

	const applyRemoteScene = useCallback(
		(
			targetApi: CollaborationApi,
			elements: RemoteElement[],
			files?: Record<string, CollabFile>,
		) => {
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

	const connect = useCallback(
		(roomId: string, key: CryptoKey, keyBase64: string) => {
			const isReconnect =
				ws.roomIdRef.current === roomId &&
				keyBase64Ref.current === keyBase64 &&
				ws.reconnectAttemptRef.current > 0;

			if (!isReconnect) {
				collaborators.applyCollaborators(new Map());
				sentFileIdsRef.current = new Set();
			}

			encryption.setKey(key);
			keyBase64Ref.current = keyBase64;
			ws.connect(roomId);
		},
		[ws, encryption, collaborators],
	);

	const startSession = useCallback(async () => {
		setSessionStatus('connecting');
		setSessionError(null);
		const roomId = createId();
		const key = await encryption.generateKey();
		const keyBase64 = await encryption.exportKey(key);
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
	}, [connect, encryption]);

	const stopSession = useCallback(() => {
		encryption.setKey(null);
		keyBase64Ref.current = null;
		isCollaboratingRef.current = false;
		ws.disconnect();
		collaborators.applyCollaborators(new Map());
		setRoomLink(null);
		setIsCollaborating(false);
		setSessionStatus('idle');
		setSessionError(null);

		if (typeof window !== 'undefined') {
			window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
		}
	}, [encryption, ws, collaborators]);

	const _broadcastCursor = useCallback(
		(
			pointer: { x: number; y: number },
			button: 'down' | 'up',
			selectedElementIds: Record<string, boolean>,
		) => {
			broadcast.broadcastCursor(
				pointer,
				button,
				selectedElementIds,
				username,
				collaborators.clientId,
				collaborators.collaboratorColor,
			);
		},
		[broadcast, username, collaborators],
	);

	const _broadcastScene = useCallback(
		(elements: readonly ExcalidrawElement[], files: Record<string, unknown> | null) => {
			broadcast.broadcastScene(elements, files);
		},
		[broadcast],
	);

	const handleSceneChange = useCallback(
		(elements: readonly ExcalidrawElement[], _appState: unknown, files: unknown) => {
			if (!isCollaboratingRef.current || isApplyingRemoteRef.current) return;
			broadcast.broadcastScene(elements, files as Record<string, unknown> | null);
		},
		[broadcast],
	);

	const handlePointerUpdate = useCallback(
		(payload: {
			pointer: { x: number; y: number };
			button: 'down' | 'up';
			pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
		}) => {
			if (!isCollaboratingRef.current) return;
			const appState = apiRef.current?.getAppState();
			broadcast.broadcastCursor(
				payload.pointer,
				payload.button,
				getSelectedElementIds((appState ?? {}) as Partial<AppState>),
				username,
				collaborators.clientId,
				collaborators.collaboratorColor,
			);
		},
		[broadcast, username, collaborators],
	);

	const lastSyncedApiRef = useRef<typeof excalidrawApi>(null);
	useEffect(() => {
		if (
			!excalidrawApi ||
			lastSyncedApiRef.current === excalidrawApi ||
			!isCollaboratingRef.current
		) {
			return;
		}

		lastSyncedApiRef.current = excalidrawApi;

		const pending = pendingSceneRef.current;
		if (pending) {
			pendingSceneRef.current = null;
			applyRemoteScene(excalidrawApi, pending.elements, pending.files);
		}

		if (isConnected()) {
			ws.send({ type: 'resync-request' });
		}
	}, [applyRemoteScene, excalidrawApi, isConnected, ws]);

	const syncWithLocationHash = useCallback(() => {
		if (typeof window === 'undefined') return;
		const parsed = parseRoomHash(window.location.hash);

		if (!parsed) {
			if (ws.roomIdRef.current || keyBase64Ref.current) {
				stopSession();
			}
			return;
		}

		if (parsed.roomId === ws.roomIdRef.current && parsed.keyBase64 === keyBase64Ref.current) {
			return;
		}

		setSessionStatus('connecting');
		setSessionError(null);
		encryption
			.importKey(parsed.keyBase64)
			.then((key) => connect(parsed.roomId, key, parsed.keyBase64))
			.catch((error) => {
				captureBrowserException(error, {
					tags: { area: 'collaboration', action: 'import_room_key' },
					extra: { roomId: parsed.roomId },
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
	}, [connect, stopSession, encryption, ws]);

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
			encryption.setKey(null);
			ws.disconnect();
		};
	});

	return {
		isCollaborating,
		collaborators: collaborators.collaborators,
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
