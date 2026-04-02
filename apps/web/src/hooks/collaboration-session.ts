import { updateSceneAndSyncAppStore } from '@/components/canvas/excalidraw-store-sync';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';

export const SCENE_THROTTLE_MS = 100;
export const CURSOR_THROTTLE_MS = 50;
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30000;
export const LAST_COLOR_INDEX_KEY = 'excalidraw_last_collab_color_index';

export type CollaboratorColor = {
	background: string;
	stroke: string;
};

export type CollaboratorState = {
	pointer?: { x: number; y: number };
	button?: 'down' | 'up';
	selectedElementIds?: Record<string, boolean>;
	username?: string;
	color?: CollaboratorColor;
	id?: string;
};

export type CollabFile = {
	id: string;
	mimeType: string;
	dataURL: string;
	created: number;
};

export type RemoteElement = ExcalidrawElement & {
	version: number;
	versionNonce: number;
	isDeleted?: boolean;
};

export type BroadcastPayload =
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

export interface CollaborationApi {
	getSceneElements(): readonly ExcalidrawElement[];
	getFiles(): Record<string, unknown>;
	getAppState(): AppState;
	addFiles(files: Array<{ id: string; mimeType: string; dataURL: string; created: number }>): void;
	updateScene(update: {
		elements?: readonly ExcalidrawElement[];
		appState?: Partial<AppState> & { collaborators?: unknown };
	}): void;
}

const COLLABORATOR_COLORS: CollaboratorColor[] = [
	{ background: '#ffa8a8', stroke: '#c92a2a' },
	{ background: '#ffd8a8', stroke: '#e67700' },
	{ background: '#fff3bf', stroke: '#e67700' },
	{ background: '#d3f9d8', stroke: '#2b8a3e' },
	{ background: '#74c0fc', stroke: '#1864ab' },
	{ background: '#e599f7', stroke: '#862e9c' },
	{ background: '#b197fc', stroke: '#5f3dc4' },
	{ background: '#63e6be', stroke: '#087f5b' },
];

function getCollaboratorColors(): CollaboratorColor[] {
	return COLLABORATOR_COLORS;
}

export function createId(): string {
	return typeof crypto.randomUUID === 'function'
		? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
		: Math.random().toString(36).slice(2, 22);
}

export function getSessionCollaboratorColor(): CollaboratorColor {
	const colors = getCollaboratorColors();
	const raw =
		typeof window !== 'undefined' ? window.localStorage.getItem(LAST_COLOR_INDEX_KEY) : null;
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

export function collectSceneBroadcastFiles(
	files: Record<string, unknown> | null,
	sentFileIds: Set<string>,
): Record<string, CollabFile> {
	const nextFiles: Record<string, CollabFile> = {};
	if (!files) return nextFiles;

	for (const [id, file] of Object.entries(files)) {
		if (sentFileIds.has(id) || !file) {
			continue;
		}

		const candidate = file as Record<string, unknown>;
		if (typeof candidate.dataURL !== 'string' || typeof candidate.mimeType !== 'string') {
			continue;
		}

		nextFiles[id] = {
			id,
			mimeType: candidate.mimeType,
			dataURL: candidate.dataURL,
			created: typeof candidate.created === 'number' ? candidate.created : Date.now(),
		};
		sentFileIds.add(id);
	}

	return nextFiles;
}

export function buildSceneBroadcastPayload(
	elements: readonly ExcalidrawElement[],
	files: Record<string, unknown> | null,
	sentFileIds: Set<string>,
): Extract<BroadcastPayload, { type: 'scene-update' }> {
	const nextFiles = collectSceneBroadcastFiles(files, sentFileIds);
	return {
		type: 'scene-update',
		elements: elements as RemoteElement[],
		...(Object.keys(nextFiles).length > 0 ? { files: nextFiles } : {}),
	};
}

export function buildCursorBroadcastPayload(
	clientId: string,
	pointer: { x: number; y: number },
	button: 'down' | 'up',
	selectedElementIds: Record<string, boolean>,
	username: string | undefined,
	color: CollaboratorColor,
): Extract<BroadcastPayload, { type: 'cursor-update' }> {
	return {
		type: 'cursor-update',
		clientId,
		pointer,
		button,
		selectedElementIds,
		username,
		color,
	};
}

export function applyCollaboratorsSnapshot(
	api: CollaborationApi | null,
	setCollaborators: (next: Map<string, CollaboratorState>) => void,
	_setAppState: (next: Partial<AppState>) => void,
	next: Map<string, CollaboratorState>,
) {
	setCollaborators(new Map(next));
	if (!api) {
		return;
	}

	const nextAppState = {
		...api.getAppState(),
		collaborators: next,
	} as unknown as Partial<AppState>;
	updateSceneAndSyncAppStore(
		api as unknown as Parameters<typeof updateSceneAndSyncAppStore>[0],
		{
			appState: { collaborators: next } as unknown as Partial<AppState>,
		},
		{
			appState: nextAppState,
		},
	);
}

export function pruneCollaboratorsBySocketIds(
	current: Map<string, CollaboratorState>,
	socketIds: Iterable<string>,
): Map<string, CollaboratorState> {
	const activeIds = new Set(socketIds);
	const next = new Map<string, CollaboratorState>();
	for (const [id, state] of current) {
		if (activeIds.has(id)) {
			next.set(id, state);
		}
	}
	return next;
}

export function applyCursorBroadcastPayload(
	current: Map<string, CollaboratorState>,
	payload: Extract<BroadcastPayload, { type: 'cursor-update' }>,
): Map<string, CollaboratorState> {
	const next = new Map(current);
	next.set(payload.clientId, {
		pointer: payload.pointer,
		button: payload.button,
		selectedElementIds: payload.selectedElementIds,
		username: payload.username,
		color: payload.color,
		id: payload.clientId,
	});
	return next;
}
