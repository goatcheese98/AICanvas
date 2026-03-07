import type { AppState } from '@excalidraw/excalidraw/types';

export interface ParsedRoomHash {
	roomId: string;
	keyBase64: string;
}

export function readStoredUsername(storage: Pick<Storage, 'getItem'> | null | undefined): string {
	if (!storage) return 'Anonymous';
	return storage.getItem('excalidraw_name') || 'Anonymous';
}

export function buildRoomHash(roomId: string, keyBase64: string): string {
	return `#room=${roomId},${keyBase64}`;
}

export function parseRoomHash(hash: string): ParsedRoomHash | null {
	const match = hash.match(/^#room=([^,]+),(.+)$/);
	return match ? { roomId: match[1], keyBase64: match[2] } : null;
}

export function buildRoomLink(baseUrl: string, roomId: string, keyBase64: string): string {
	return `${baseUrl}${buildRoomHash(roomId, keyBase64)}`;
}

export function getPartykitHost(envHost?: string): string {
	if (envHost && envHost.trim().length > 0) return envHost;
	if (typeof window === 'undefined') return 'localhost:1999';
	return window.location.hostname === 'localhost' ? 'localhost:1999' : 'localhost:1999';
}

export function getPartykitWebSocketUrl(roomId: string, host: string, secure?: boolean): string {
	const protocol =
		secure ?? (typeof window !== 'undefined' ? window.location.protocol === 'https:' : false)
			? 'wss'
			: 'ws';
	return `${protocol}://${host}/parties/main/${roomId}`;
}

const PERSISTENCE_APP_STATE_KEYS_TO_DROP = [
	'collaborators',
	'width',
	'height',
	'offsetLeft',
	'offsetTop',
	'selectedElementIds',
	'selectedGroupIds',
	'editingGroupId',
	'editingLinearElement',
	'editingTextElement',
	'selectedLinearElement',
	'multiElement',
	'selectionElement',
	'newElement',
	'resizingElement',
	'contextMenu',
	'openDialog',
	'activeEmbeddable',
	'suggestedBindings',
	'elementsToHighlight',
	'frameToHighlight',
	'searchMatches',
	'draggingElement',
	'selectedElementsAreBeingDragged',
	'croppingElementId',
	'isCropping',
] as const;

export function sanitizePersistedCanvasAppState(appState: Record<string, unknown>) {
	const nextState = { ...appState };
	for (const key of PERSISTENCE_APP_STATE_KEYS_TO_DROP) {
		delete nextState[key];
	}
	return nextState;
}

export function getSelectedElementIds(appState: Partial<AppState>): Record<string, boolean> {
	return (appState.selectedElementIds ?? {}) as Record<string, boolean>;
}
