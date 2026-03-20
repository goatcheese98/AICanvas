import { useAuth } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import {
	api,
	createObservedResponseError,
	getRequiredAuthHeaders,
	observedFetch,
	toApiUrl,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import {
	CanvasPersistenceCoordinator,
	type CanvasData,
	type PersistenceState,
} from '@/lib/persistence/CanvasPersistenceCoordinator';
import { useAppStore } from '@/stores/store';

import {
	getExportToBlob,
	getThumbnailSignature,
	toBinaryFileList,
	toBinaryFiles,
} from './canvas-container-utils';

const SERVER_SAVE_THROTTLE_MS = 5000;
const THUMBNAIL_MIME_TYPE = 'image/png';

interface UseCanvasPersistenceProps {
	canvasId: string;
}

interface UseCanvasPersistenceReturn extends PersistenceState {
	/** Coordinator instance for local storage persistence */
	coordinatorRef: React.RefObject<CanvasPersistenceCoordinator | null>;
	/** Latest scene data ref for access during cleanup */
	latestSceneRef: React.RefObject<CanvasData | null>;
	/** Trigger a server save with throttling */
	scheduleServerSave: (data: CanvasData) => void;
	/** Persist thumbnail if changed */
	persistThumbnail: (data: CanvasData) => Promise<void>;
	/** Force immediate server save */
	forceServerSave: (data: CanvasData) => Promise<void>;
	/** Cleanup coordinator and pending saves */
	cleanup: () => void;
}

/**
 * Manages canvas persistence: local storage and server sync.
 *
 * Responsibilities:
 * - Local storage persistence via CanvasPersistenceCoordinator
 * - Throttled server saves
 * - Thumbnail generation and upload
 * - Persistence state tracking (isSaving, lastSaved, hasUnsavedChanges)
 *
 * Anti-slop: No API management, no UI state, no scene change detection.
 * Pure persistence coordination only.
 */
export function useCanvasPersistence({
	canvasId,
}: UseCanvasPersistenceProps): UseCanvasPersistenceReturn {
	const { getToken } = useAuth();
	const queryClient = useQueryClient();
	const setPersistenceState = useAppStore((s) => s.setPersistenceState);

	// Coordinator is stable for the lifetime of this component
	const coordinatorRef = useRef<CanvasPersistenceCoordinator | null>(null);
	if (!coordinatorRef.current) {
		coordinatorRef.current = new CanvasPersistenceCoordinator({
			onStateChange: setPersistenceState,
		});
	}

	// Throttled server save — only fires after 5s of inactivity
	const serverSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestSceneRef = useRef<CanvasData | null>(null);
	const latestThumbnailSignatureRef = useRef<string | null>(null);
	const inFlightThumbnailSignatureRef = useRef<string | null>(null);

	const persistThumbnail = useCallback(
		async (data: CanvasData) => {
			const signature = getThumbnailSignature(data);
			if (
				signature === latestThumbnailSignatureRef.current ||
				signature === inFlightThumbnailSignatureRef.current
			) {
				return;
			}

			const nonDeletedElements = data.elements.filter(
				(element) => (element as Record<string, unknown>).isDeleted !== true,
			);
			if (nonDeletedElements.length === 0) return;

			inFlightThumbnailSignatureRef.current = signature;

			try {
				const exportToBlob = await getExportToBlob();
				const blob = await exportToBlob({
					elements: nonDeletedElements as never,
					appState: {
						...(data.appState ?? {}),
						exportBackground: true,
						viewBackgroundColor:
							typeof data.appState?.viewBackgroundColor === 'string'
								? data.appState.viewBackgroundColor
								: '#ffffff',
					},
					files: (data.files ?? {}) as Record<string, unknown> as never,
					mimeType: THUMBNAIL_MIME_TYPE,
					exportPadding: 16,
				});

				const headers = await getRequiredAuthHeaders(getToken);
				const response = await observedFetch(
					toApiUrl(`/api/canvas/${canvasId}/thumbnail`),
					{
						method: 'POST',
						headers: {
							...headers,
							'Content-Type': THUMBNAIL_MIME_TYPE,
						},
						body: blob,
					},
				);

				if (!response.ok) {
					throw await createObservedResponseError(
						response,
						`Thumbnail upload failed with status ${response.status}`,
					);
				}

				latestThumbnailSignatureRef.current = signature;
				void queryClient.invalidateQueries({ queryKey: ['canvases'] });
			} catch (err) {
				console.error('Thumbnail upload failed:', err);
				captureBrowserException(err, {
					tags: {
						area: 'canvas.thumbnail',
						action: 'upload',
					},
					extra: {
						canvasId,
						signature,
					},
				});
			} finally {
				if (inFlightThumbnailSignatureRef.current === signature) {
					inFlightThumbnailSignatureRef.current = null;
				}
			}
		},
		[canvasId, getToken, queryClient],
	);

	const persistServerSave = useCallback(
		async (data: CanvasData) => {
			try {
				const headers = await getRequiredAuthHeaders(getToken);
				const response = await api.api.canvas[':id'].$put(
					{
						param: { id: canvasId },
						json: {
							elements: data.elements as Record<string, unknown>[],
							appState: data.appState,
							files: data.files as Record<string, unknown> | null,
						},
					},
					{ headers },
				);

				if (!response.ok) {
					throw new Error(await response.text());
				}

				await Promise.all([
					queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] }),
					queryClient.invalidateQueries({ queryKey: ['canvases'] }),
				]);
				void persistThumbnail(data);
			} catch (err) {
				console.error('Server auto-save failed:', err);
				captureBrowserException(err, {
					tags: {
						area: 'canvas.save',
						action: 'server_autosave',
					},
					extra: {
						canvasId,
						elementCount: data.elements.length,
					},
				});
			}
		},
		[canvasId, getToken, persistThumbnail, queryClient],
	);

	const scheduleServerSave = useCallback(
		(data: CanvasData) => {
			latestSceneRef.current = data;
			if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = setTimeout(() => {
				void persistServerSave(data);
			}, SERVER_SAVE_THROTTLE_MS);
		},
		[persistServerSave],
	);

	const forceServerSave = useCallback(
		async (data: CanvasData) => {
			await persistServerSave(data);
		},
		[persistServerSave],
	);

	const cleanup = useCallback(() => {
		coordinatorRef.current?.dispose();
		if (serverSaveTimeoutRef.current) {
			clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = null;
		}
	}, []);

	// Get current persistence state from coordinator
	const coordinatorState = coordinatorRef.current?.getState() ?? {
		isSaving: false,
		lastSaved: null,
		hasUnsavedChanges: false,
	};

	return {
		...coordinatorState,
		coordinatorRef,
		latestSceneRef,
		scheduleServerSave,
		persistThumbnail,
		forceServerSave,
		cleanup,
	};
}
