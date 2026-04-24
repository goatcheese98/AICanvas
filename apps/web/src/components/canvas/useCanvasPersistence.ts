import { useAuth } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import {
	api,
	createObservedResponseError,
	getRequiredAuthHeaders,
	observedFetch,
	toApiUrl,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import {
	type CanvasData,
	CanvasPersistenceCoordinator,
	type PersistenceState,
} from '@/lib/persistence/CanvasPersistenceCoordinator';
import { useAppStore } from '@/stores/store';

import { getExportToBlob, getThumbnailSignature } from './canvas-container-utils';

const SERVER_SAVE_THROTTLE_MS = 5000;
const SERVER_SAVE_INTERVAL_MS = 60_000;
const THUMBNAIL_MIME_TYPE = 'image/png';

interface UseCanvasPersistenceProps {
	canvasId: string;
}

interface UseCanvasPersistenceReturn extends PersistenceState {
	/** Latest confirmed server-side canvas version */
	canvasVersionRef: React.RefObject<number | null>;
	/** Coordinator instance for local storage persistence */
	coordinatorRef: React.RefObject<CanvasPersistenceCoordinator | null>;
	/** Whether a server save still needs to be flushed */
	hasPendingServerSaveRef: React.RefObject<boolean>;
	/** Whether saving is blocked until the user refreshes after a conflict */
	hasVersionConflictRef: React.RefObject<boolean>;
	/** Latest scene data ref for access during cleanup */
	latestSceneRef: React.RefObject<CanvasData | null>;
	/** Trigger a server save with throttling */
	scheduleServerSave: (data: CanvasData) => void;
	/** Persist thumbnail if changed */
	persistThumbnail: (data: CanvasData) => Promise<void>;
	/** Force immediate server save */
	forceServerSave: (data: CanvasData) => Promise<boolean>;
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
	const addToast = useAppStore((s) => s.addToast);
	const setPersistenceState = useAppStore((s) => s.setPersistenceState);
	const setRemoteSaving = useAppStore((s) => s.setRemoteSaving);

	// Coordinator is stable for the lifetime of this component
	const coordinatorRef = useRef<CanvasPersistenceCoordinator | null>(null);
	if (!coordinatorRef.current) {
		coordinatorRef.current = new CanvasPersistenceCoordinator({
			onStateChange: setPersistenceState,
		});
	}

	// Throttled server save — only fires after 5s of inactivity
	const serverSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const serverSaveInFlightRef = useRef(false);
	const canvasVersionRef = useRef<number | null>(null);
	const hasPendingServerSaveRef = useRef(false);
	const hasVersionConflictRef = useRef(false);
	const latestSceneRef = useRef<CanvasData | null>(null);
	const latestThumbnailSignatureRef = useRef<string | null>(null);
	const inFlightThumbnailSignatureRef = useRef<string | null>(null);

	const clearScheduledServerSave = useCallback(() => {
		if (serverSaveTimeoutRef.current) {
			clearTimeout(serverSaveTimeoutRef.current);
			serverSaveTimeoutRef.current = null;
		}
	}, []);

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
				const response = await observedFetch(toApiUrl(`/api/canvas/${canvasId}/thumbnail`), {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': THUMBNAIL_MIME_TYPE,
					},
					body: blob,
				});

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
		async (data: CanvasData): Promise<boolean> => {
			if (serverSaveInFlightRef.current) {
				hasPendingServerSaveRef.current = true;
				return false;
			}

			if (hasVersionConflictRef.current) {
				return false;
			}

			const expectedVersion = canvasVersionRef.current;
			if (typeof expectedVersion !== 'number' || expectedVersion < 1) {
				hasPendingServerSaveRef.current = false;
				hasVersionConflictRef.current = true;
				addToast({
					message: 'Canvas sync state is stale. Refresh before saving again.',
					type: 'error',
				});
				return false;
			}

			serverSaveInFlightRef.current = true;
			setRemoteSaving(true);
			try {
				const headers = await getRequiredAuthHeaders(getToken);
				const response = await api.api.canvas[':id'].$put(
					{
						param: { id: canvasId },
						json: {
							elements: data.elements as Record<string, unknown>[],
							appState: data.appState,
							files: data.files as Record<string, unknown> | null,
							expectedVersion,
						},
					},
					{ headers },
				);

				if (response.status === 409) {
					hasPendingServerSaveRef.current = false;
					hasVersionConflictRef.current = true;
					clearScheduledServerSave();
					addToast({
						message: 'Canvas changed in another session. Refresh before saving again.',
						type: 'error',
					});
					return false;
				}

				if (!response.ok) {
					throw new Error(await response.text());
				}

				const result = (await response.json()) as {
					success?: boolean;
					version?: number;
				};
				if (!result.success || typeof result.version !== 'number') {
					throw new Error('Canvas save returned an invalid response.');
				}

				canvasVersionRef.current = result.version;
				hasVersionConflictRef.current = false;

				await Promise.all([
					queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] }),
					queryClient.invalidateQueries({ queryKey: ['canvases'] }),
				]);
				hasPendingServerSaveRef.current = latestSceneRef.current !== data;
				void persistThumbnail(data);
				return true;
			} catch (err) {
				hasPendingServerSaveRef.current = true;
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
				return false;
			} finally {
				serverSaveInFlightRef.current = false;
				setRemoteSaving(false);
				if (
					hasPendingServerSaveRef.current &&
					latestSceneRef.current &&
					latestSceneRef.current !== data &&
					!hasVersionConflictRef.current &&
					serverSaveTimeoutRef.current === null
				) {
					void persistServerSave(latestSceneRef.current);
				}
			}
		},
		[
			addToast,
			canvasId,
			clearScheduledServerSave,
			getToken,
			persistThumbnail,
			queryClient,
			setRemoteSaving,
		],
	);

	const scheduleServerSave = useCallback(
		(data: CanvasData) => {
			latestSceneRef.current = data;
			hasPendingServerSaveRef.current = true;
			clearScheduledServerSave();
			serverSaveTimeoutRef.current = setTimeout(() => {
				serverSaveTimeoutRef.current = null;
				void persistServerSave(data);
			}, SERVER_SAVE_THROTTLE_MS);
		},
		[clearScheduledServerSave, persistServerSave],
	);

	const forceServerSave = useCallback(
		async (data: CanvasData) => {
			hasPendingServerSaveRef.current = true;
			clearScheduledServerSave();
			return persistServerSave(data);
		},
		[clearScheduledServerSave, persistServerSave],
	);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			if (
				!hasPendingServerSaveRef.current ||
				!latestSceneRef.current ||
				hasVersionConflictRef.current
			) {
				return;
			}

			clearScheduledServerSave();
			void persistServerSave(latestSceneRef.current);
		}, SERVER_SAVE_INTERVAL_MS);

		return () => window.clearInterval(intervalId);
	}, [clearScheduledServerSave, persistServerSave]);

	const cleanup = useCallback(() => {
		coordinatorRef.current?.dispose();
		clearScheduledServerSave();
		setRemoteSaving(false);
	}, [clearScheduledServerSave, setRemoteSaving]);

	// Get current persistence state from coordinator
	const coordinatorState =
		typeof coordinatorRef.current?.getState === 'function'
			? coordinatorRef.current.getState()
			: {
					isSaving: false,
					lastSaved: null,
					hasUnsavedChanges: false,
				};

	return {
		...coordinatorState,
		canvasVersionRef,
		coordinatorRef,
		hasPendingServerSaveRef,
		hasVersionConflictRef,
		latestSceneRef,
		scheduleServerSave,
		persistThumbnail,
		forceServerSave,
		cleanup,
	};
}
