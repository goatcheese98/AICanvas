import { useCallback, useEffect, useRef, useState } from 'react';
import { reconcileElements } from '@excalidraw/excalidraw';
import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	ClientToServerMessage,
	ServerToClientMessage,
} from '@ai-canvas/shared/types';
import { useAppStore } from '@/stores/store';
import { decryptData, encryptData, exportKey, generateEncryptionKey, importKey } from '@/lib/collab/encryption';
import {
	buildRoomHash,
	buildRoomLink,
	getReconnectDelayMs,
	getPartykitHost,
	getPartykitWebSocketUrl,
	getSelectedElementIds,
	parseRoomHash,
	readStoredUsername,
	type CollaborationSessionStatus,
} from './collaboration-utils';

const SCENE_THROTTLE_MS = 100;
const CURSOR_THROTTLE_MS = 50;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const LAST_COLOR_INDEX_KEY = 'excalidraw_last_collab_color_index';

type CollaboratorColor = {
	background: string;
	stroke: string;
};

type CollaboratorState = {
	pointer?: { x: number; y: number };
	button?: 'down' | 'up';
	selectedElementIds?: Record<string, boolean>;
	username?: string;
	color?: CollaboratorColor;
	id?: string;
};

type CollabFile = {
	id: string;
	mimeType: string;
	dataURL: string;
	created: number;
};

type RemoteElement = ExcalidrawElement & {
	version: number;
	versionNonce: number;
	isDeleted?: boolean;
};

type BroadcastPayload =
	| {
			type: 'scene-update';
			elements: RemoteElement[];
			files?: Record<string, CollabFile>;
	  }
	| {
			type: 'cursor-update';
			clientId: string;
			pointer: { x: number; y: number };
			button: 'down' | 'up';
			selectedElementIds: Record<string, boolean>;
			username?: string;
			color: CollaboratorColor;
	  };

interface CollaborationOptions {
	onError?: (message: string) => void;
}

function getCollaboratorColors(): CollaboratorColor[] {
	return [
		{ background: '#ffa8a8', stroke: '#c92a2a' },
		{ background: '#ffd8a8', stroke: '#e67700' },
		{ background: '#fff3bf', stroke: '#e67700' },
		{ background: '#d3f9d8', stroke: '#2b8a3e' },
		{ background: '#74c0fc', stroke: '#1864ab' },
		{ background: '#e599f7', stroke: '#862e9c' },
		{ background: '#b197fc', stroke: '#5f3dc4' },
		{ background: '#63e6be', stroke: '#087f5b' },
	];
}

function createId(): string {
	return typeof crypto.randomUUID === 'function'
		? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
		: Math.random().toString(36).slice(2, 22);
}

function getSessionCollaboratorColor(): CollaboratorColor {
	const colors = getCollaboratorColors();
	const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_COLOR_INDEX_KEY) : null;
	const previousIndex = raw !== null ? Number.parseInt(raw, 10) : Number.NaN;
	let nextIndex = Math.floor(Math.random() * colors.length);

	if (colors.length > 1 && Number.isInteger(previousIndex) && nextIndex === previousIndex) {
		nextIndex = (nextIndex + 1) % colors.length;
	}

	if (typeof window !== 'undefined') {
		window.localStorage.setItem(LAST_COLOR_INDEX_KEY, String(nextIndex));
	}

	return colors[nextIndex] ?? colors[0]!;
}

function useThrottledCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
	const lastRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fnRef = useRef(fn);
	fnRef.current = fn;

	return useCallback(
		(...args: A) => {
			const now = Date.now();
			if (now - lastRef.current >= ms) {
				lastRef.current = now;
				if (timerRef.current) {
					clearTimeout(timerRef.current);
					timerRef.current = null;
				}
				fnRef.current(...args);
			} else {
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(() => {
					lastRef.current = Date.now();
					timerRef.current = null;
					fnRef.current(...args);
				}, ms - (now - lastRef.current));
			}
		},
		[ms],
	);
}

export function useCollaboration({ onError }: CollaborationOptions = {}) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const setAppState = useAppStore((s) => s.setAppState);
	const [isCollaborating, setIsCollaborating] = useState(false);
	const [roomLink, setRoomLink] = useState<string | null>(null);
	const [username, setUsernameState] = useState(() =>
		typeof window === 'undefined' ? 'Anonymous' : readStoredUsername(window.localStorage),
	);
	const [collaborators, setCollaborators] = useState<Map<string, CollaboratorState>>(new Map());
	const [sessionStatus, setSessionStatus] = useState<CollaborationSessionStatus>('idle');
	const [sessionError, setSessionError] = useState<string | null>(null);

	const apiRef = useRef(excalidrawApi);
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
	const collaboratorsRef = useRef<Map<string, CollaboratorState>>(new Map());
	const sentFileIdsRef = useRef<Set<string>>(new Set());
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptRef = useRef(0);
	const isApplyingRemoteRef = useRef(false);
	const pendingSceneRef = useRef<{
		elements: RemoteElement[];
		files?: Record<string, CollabFile>;
	} | null>(null);

	const setUsername = useCallback((name: string) => {
		setUsernameState(name);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('excalidraw_name', name);
		}
	}, []);

	const broadcastSceneRaw = useCallback(
		async (
			elements: readonly ExcalidrawElement[],
			files: Record<string, unknown> | null,
			volatile: boolean,
		) => {
			const ws = wsRef.current;
			const key = encKeyRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN || !key) return;

			const newFiles: Record<string, CollabFile> = {};
			if (files) {
				for (const [id, file] of Object.entries(files)) {
					if (!sentFileIdsRef.current.has(id) && file) {
						const candidate = file as Record<string, unknown>;
						if (typeof candidate.dataURL === 'string' && typeof candidate.mimeType === 'string') {
							newFiles[id] = {
								id,
								mimeType: candidate.mimeType,
								dataURL: candidate.dataURL,
								created: typeof candidate.created === 'number' ? candidate.created : Date.now(),
							};
							sentFileIdsRef.current.add(id);
						}
					}
				}
			}

			const payload: BroadcastPayload = {
				type: 'scene-update',
				elements: elements as RemoteElement[],
				...(Object.keys(newFiles).length > 0 ? { files: newFiles } : {}),
			};

			try {
				const encrypted = await encryptData(JSON.stringify(payload), key);
				const msgType: ClientToServerMessage['type'] = volatile
					? 'server-volatile-broadcast'
					: 'server-broadcast';
				ws.send(JSON.stringify({ type: msgType, ...encrypted }));
			} catch (error) {
				console.error('[Collab] Encrypt/send failed:', error);
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

			const payload: BroadcastPayload = {
				type: 'cursor-update',
				clientId: clientIdRef.current,
				pointer,
				button,
				selectedElementIds,
				username,
				color: collaboratorColorRef.current,
			};

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

	const applyCollaborators = useCallback((next: Map<string, CollaboratorState>) => {
		collaboratorsRef.current = next;
		setCollaborators(new Map(next));
		const api = apiRef.current;
		if (!api) return;
		api.updateScene({
			appState: { collaborators: next } as Parameters<typeof api.updateScene>[0]['appState'],
		});
		setAppState({
			...api.getAppState(),
			collaborators: next,
		} as Partial<AppState>);
	}, [setAppState]);

	const applyRemoteScene = useCallback(
		(
			targetApi: NonNullable<typeof excalidrawApi>,
			elements: RemoteElement[],
			files?: Record<string, CollabFile>,
		) => {
			if (files) {
				const toAdd = Object.values(files).map((file) => ({
					id: file.id,
					mimeType: file.mimeType,
					dataURL: file.dataURL,
					created: file.created,
				}));
				if (toAdd.length > 0) {
					targetApi.addFiles(toAdd as Parameters<typeof targetApi.addFiles>[0]);
					for (const file of toAdd) sentFileIdsRef.current.add(file.id);
				}
			}

			const localElements = targetApi.getSceneElements();
			const localAppState = targetApi.getAppState();
			const reconciled = reconcileElements(
				localElements as Parameters<typeof reconcileElements>[0],
				elements as unknown as Parameters<typeof reconcileElements>[1],
				localAppState as Parameters<typeof reconcileElements>[2],
			);

			isApplyingRemoteRef.current = true;
			targetApi.updateScene({ elements: reconciled });
			queueMicrotask(() => {
				isApplyingRemoteRef.current = false;
			});
		},
		[],
	);

	const handleMessage = useCallback(
		async (event: MessageEvent) => {
			const key = encKeyRef.current;
			if (!key) return;

			let msg: ServerToClientMessage;
			try {
				msg = JSON.parse(event.data as string) as ServerToClientMessage;
			} catch {
				return;
			}

			const api = apiRef.current;

			switch (msg.type) {
				case 'init-room':
					break;
				case 'first-in-room':
				case 'new-user':
					if (api) {
						await broadcastSceneRaw(
							api.getSceneElements() as readonly ExcalidrawElement[],
							api.getFiles() as Record<string, unknown>,
							false,
						);
					}
					break;
				case 'room-user-change': {
					const activeIds = new Set(msg.socketIds);
					const updated = new Map<string, CollaboratorState>();
					for (const [id, state] of collaboratorsRef.current) {
						if (activeIds.has(id)) updated.set(id, state);
					}
					applyCollaborators(updated);
					break;
				}
				case 'resync-request':
					if (api) {
						await broadcastSceneRaw(
							api.getSceneElements() as readonly ExcalidrawElement[],
							api.getFiles() as Record<string, unknown>,
							false,
						);
					}
					break;
				case 'client-broadcast': {
					let decryptedPayload: BroadcastPayload;
					try {
						const decrypted = await decryptData(msg.payload, msg.iv, key);
						decryptedPayload = JSON.parse(decrypted) as BroadcastPayload;
					} catch {
						break;
					}

					if (decryptedPayload.type === 'scene-update') {
						if (!api) {
							pendingSceneRef.current = {
								elements: decryptedPayload.elements,
								files: decryptedPayload.files,
							};
							break;
						}
						applyRemoteScene(api, decryptedPayload.elements, decryptedPayload.files);
					} else {
						const updated = new Map(collaboratorsRef.current);
						updated.set(decryptedPayload.clientId, {
							pointer: decryptedPayload.pointer,
							button: decryptedPayload.button,
							selectedElementIds: decryptedPayload.selectedElementIds,
							username: decryptedPayload.username,
							color: decryptedPayload.color,
							id: decryptedPayload.clientId,
						});
						applyCollaborators(updated);
					}
					break;
				}
			}
		},
		[applyCollaborators, applyRemoteScene, broadcastSceneRaw],
	);

	const connect = useCallback(
		(roomId: string, key: CryptoKey, keyBase64: string) => {
			const isReconnect =
				roomIdRef.current === roomId && keyBase64Ref.current === keyBase64 && reconnectAttemptRef.current > 0;

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
				collaboratorsRef.current = new Map();
				setCollaborators(new Map());
				reconnectAttemptRef.current = 0;
			}
			setSessionError(null);
			setSessionStatus(isReconnect ? 'reconnecting' : 'connecting');

			const host = getPartykitHost();
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
			window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
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

		applyCollaborators(new Map());
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

	useEffect(() => {
		if (!excalidrawApi || !isCollaboratingRef.current) return;

		const pending = pendingSceneRef.current;
		if (pending) {
			pendingSceneRef.current = null;
			applyRemoteScene(excalidrawApi, pending.elements, pending.files);
		}

		const ws = wsRef.current;
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'resync-request' satisfies ClientToServerMessage['type'] }));
		}
	}, [applyRemoteScene, excalidrawApi]);

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
			.catch(() => {
				const message = 'Could not join collaboration room — the link appears to be invalid or corrupted.';
				setSessionStatus('error');
				setSessionError(message);
				onErrorRef.current?.(message);
				window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
			});
	}, [connect, stopSession]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		syncWithLocationHash();
		window.addEventListener('hashchange', syncWithLocationHash);
		return () => {
			window.removeEventListener('hashchange', syncWithLocationHash);
		};
	}, [syncWithLocationHash]);

	useEffect(() => {
		return () => {
			encKeyRef.current = null;
			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
			wsRef.current?.close();
		};
	}, []);

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
