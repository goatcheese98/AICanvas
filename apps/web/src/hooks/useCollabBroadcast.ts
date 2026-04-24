import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useRef } from 'react';
import {
	CURSOR_THROTTLE_MS,
	type CollaboratorColor,
	SCENE_THROTTLE_MS,
	buildCursorBroadcastPayload,
	buildSceneBroadcastPayload,
} from './collaboration-session';
import { useThrottledCallback } from './useThrottledCallback';

interface CollabBroadcast {
	broadcastCursor: (
		pointer: { x: number; y: number },
		button: 'down' | 'up',
		selectedElementIds: Record<string, boolean>,
		username: string | undefined,
		clientId: string,
		color: CollaboratorColor,
	) => void;
	broadcastScene: (
		elements: readonly ExcalidrawElement[],
		files: Record<string, unknown> | null,
	) => void;
	broadcastSceneRaw: (
		elements: readonly ExcalidrawElement[],
		files: Record<string, unknown> | null,
	) => Promise<void>;
}

interface BroadcastDependencies {
	isConnected: () => boolean;
	encrypt: (plaintext: string) => Promise<{ payload: string; iv: string } | null>;
	send: (message: {
		type: 'server-volatile-broadcast' | 'server-broadcast';
		payload: string;
		iv: string;
	}) => boolean;
	sentFileIdsRef: { current: Set<string> };
}

export function useCollabBroadcast(deps: BroadcastDependencies): CollabBroadcast {
	const { isConnected, encrypt, send, sentFileIdsRef } = deps;

	// Keep ref to latest values for throttled callbacks
	const depsRef = useRef(deps);
	depsRef.current = deps;

	const broadcastSceneRaw = useCallback(
		async (
			elements: readonly ExcalidrawElement[],
			files: Record<string, unknown> | null,
			volatile = false,
		) => {
			if (!isConnected()) return;

			const payload = buildSceneBroadcastPayload(elements, files, sentFileIdsRef.current);

			try {
				const encrypted = await encrypt(JSON.stringify(payload));
				if (!encrypted) return;
				const msgType = volatile ? 'server-volatile-broadcast' : 'server-broadcast';
				send({ type: msgType, ...encrypted });
			} catch {
				// Silent fail for scene broadcast - encryption errors are logged elsewhere
			}
		},
		[isConnected, encrypt, send, sentFileIdsRef],
	);

	const broadcastCursorRaw = useCallback(
		async (
			pointer: { x: number; y: number },
			button: 'down' | 'up',
			selectedElementIds: Record<string, boolean>,
			username: string | undefined,
			clientId: string,
			color: CollaboratorColor,
		) => {
			if (!depsRef.current.isConnected()) return;

			const payload = buildCursorBroadcastPayload(
				clientId,
				pointer,
				button,
				selectedElementIds,
				username,
				color,
			);

			try {
				const encrypted = await depsRef.current.encrypt(JSON.stringify(payload));
				if (!encrypted) return;
				depsRef.current.send({ type: 'server-volatile-broadcast', ...encrypted });
			} catch {
				// Ignore cursor send failures
			}
		},
		[],
	);

	const broadcastSceneThrottled = useThrottledCallback(
		(elements: readonly ExcalidrawElement[], files: Record<string, unknown> | null) => {
			void broadcastSceneRaw(elements, files, false);
		},
		SCENE_THROTTLE_MS,
	);

	const broadcastCursorThrottled = useThrottledCallback(
		(
			pointer: { x: number; y: number },
			button: 'down' | 'up',
			selectedElementIds: Record<string, boolean>,
			username: string | undefined,
			clientId: string,
			color: CollaboratorColor,
		) => {
			void broadcastCursorRaw(pointer, button, selectedElementIds, username, clientId, color);
		},
		CURSOR_THROTTLE_MS,
	);

	return {
		broadcastCursor: broadcastCursorThrottled,
		broadcastScene: broadcastSceneThrottled,
		broadcastSceneRaw,
	};
}
