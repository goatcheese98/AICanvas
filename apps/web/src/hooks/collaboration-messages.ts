import { decryptData } from '@/lib/collab/encryption';
import { addObservabilityBreadcrumb } from '@/lib/observability';
import type { ServerToClientMessage } from '@ai-canvas/shared/types';
import type {
	BroadcastPayload,
	CollabFile,
	CollaborationApi,
	CollaboratorState,
	RemoteElement,
} from './collaboration-session';
import {
	applyCursorBroadcastPayload,
	pruneCollaboratorsBySocketIds,
} from './collaboration-session';

interface CollaborationMessageDependencies {
	getApi: () => CollaborationApi | null;
	getKey: () => CryptoKey | null;
	getRoomId: () => string | null;
	collaboratorsRef: { current: Map<string, CollaboratorState> };
	pendingSceneRef: {
		current: { elements: RemoteElement[]; files?: Record<string, CollabFile> } | null;
	};
	broadcastSceneRaw: (
		elements: readonly import('@excalidraw/excalidraw/element/types').ExcalidrawElement[],
		files: Record<string, unknown> | null,
		volatile: boolean,
	) => Promise<void>;
	applyCollaborators: (next: Map<string, CollaboratorState>) => void;
	applyRemoteScene: (
		api: CollaborationApi,
		elements: RemoteElement[],
		files?: Record<string, CollabFile>,
	) => void;
}

export async function processCollaborationServerMessage(
	event: MessageEvent,
	deps: CollaborationMessageDependencies,
) {
	const key = deps.getKey();
	if (!key) return;

	let msg: ServerToClientMessage;
	try {
		msg = JSON.parse(event.data as string) as ServerToClientMessage;
	} catch {
		addObservabilityBreadcrumb(
			'collaboration.message_parse_failed',
			{
				roomId: deps.getRoomId(),
			},
			'warning',
			'collaboration',
		);
		return;
	}

	const api = deps.getApi();

	switch (msg.type) {
		case 'init-room':
			break;
		case 'first-in-room':
		case 'new-user':
			if (api) {
				await deps.broadcastSceneRaw(
					api.getSceneElements(),
					api.getFiles() as Record<string, unknown>,
					false,
				);
			}
			break;
		case 'room-user-change': {
			deps.applyCollaborators(
				pruneCollaboratorsBySocketIds(deps.collaboratorsRef.current, msg.socketIds),
			);
			break;
		}
		case 'resync-request':
			if (api) {
				await deps.broadcastSceneRaw(
					api.getSceneElements(),
					api.getFiles() as Record<string, unknown>,
					false,
				);
			}
			break;
		case 'client-broadcast': {
			try {
				const decrypted = await decryptData(msg.payload, msg.iv, key);
				const decryptedPayload = JSON.parse(decrypted) as BroadcastPayload;

				if (decryptedPayload.type === 'scene-update') {
					if (!api) {
						deps.pendingSceneRef.current = {
							elements: decryptedPayload.elements,
							files: decryptedPayload.files,
						};
						break;
					}
					deps.applyRemoteScene(api, decryptedPayload.elements, decryptedPayload.files);
				} else {
					deps.applyCollaborators(
						applyCursorBroadcastPayload(deps.collaboratorsRef.current, decryptedPayload),
					);
				}
			} catch {
				addObservabilityBreadcrumb(
					'collaboration.message_decrypt_failed',
					{
						roomId: deps.getRoomId(),
						messageType: msg.type,
					},
					'warning',
					'collaboration',
				);
				break;
			}
			break;
		}
	}
}
