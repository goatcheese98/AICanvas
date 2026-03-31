import { buildPersistedCanvasData } from '@/components/canvas/canvas-persistence-utils';
import { bumpElementVersion } from '@/components/canvas/overlay-definition-types';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { KanbanBoardContainer } from '@/components/overlays/kanban/KanbanBoardContainer';
import { FocusedViewHeader, ProjectShell } from '@/components/shell';
import { buildProjectResources } from '@/components/shell/project-resource-utils';
import type { ProjectResource } from '@/components/shell/types';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useMountEffect } from '@/hooks/useMountEffect';
import { api, getRequiredAuthHeaders, toApiUrl } from '@/lib/api';
import { useAppStore } from '@/stores/store';
import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type { HeavyResourceRecord, KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getOpenBoardElements } from './board-studio-utils';

interface CanvasQueryData {
	canvas?: {
		title?: unknown;
		version?: unknown;
	};
	data?: {
		elements?: readonly ExcalidrawElement[];
		appState?: Record<string, unknown>;
		files?: Record<string, unknown> | null;
	};
}

interface BoardStudioPageProps {
	canvasId: string;
	boardId: string;
}

interface BoardStudioWorkspaceProps {
	canvasId: string;
	canvasTitle: string;
	boardElement: ExcalidrawElement & { customData: KanbanOverlayCustomData };
	initialElements: readonly ExcalidrawElement[];
	initialAppState: Record<string, unknown>;
	initialFiles: Record<string, unknown> | null;
	initialVersion: number;
}

function BoardStudioWorkspace({
	canvasId,
	canvasTitle,
	boardElement,
	initialElements,
	initialAppState,
	initialFiles,
	initialVersion,
}: BoardStudioWorkspaceProps) {
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const addToast = useAppStore((s) => s.addToast);
	const collaboration = useCollaboration({
		onError: (message) => addToast({ message, type: 'error' }),
	});

	const [sceneElements, setSceneElements] = useState<readonly ExcalidrawElement[]>(initialElements);
	const sceneElementsRef = useRef(sceneElements);
	const appStateRef = useRef<Record<string, unknown>>(initialAppState);
	const filesRef = useRef<Record<string, unknown> | null>(initialFiles);
	const versionRef = useRef(initialVersion);
	const queuedCanvasDataRef = useRef<ReturnType<typeof buildPersistedCanvasData> | null>(null);
	const saveInFlightRef = useRef(false);
	const isMountedRef = useRef(true);

	sceneElementsRef.current = sceneElements;

	useMountEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	});

	const boardElements = useMemo(() => getOpenBoardElements(sceneElements), [sceneElements]);
	const matchedBoardElement = useMemo(
		() => boardElements.find((element) => element.id === boardElement.id) ?? null,
		[boardElements, boardElement.id],
	);
	const fallbackBoardElement = useMemo(
		() => (matchedBoardElement ? null : (boardElements[0] ?? null)),
		[matchedBoardElement, boardElements],
	);
	const activeBoardElement = matchedBoardElement ?? fallbackBoardElement;

	const resources = useMemo(
		() =>
			buildProjectResources({
				canvasId,
				canvasName: canvasTitle,
				elements: sceneElements,
			}),
		[canvasId, canvasTitle, sceneElements],
	);

	const handleNavigateToResource = useCallback(
		(resource: ProjectResource) => {
			if (resource.type === 'canvas') {
				void navigate({ to: '/canvas/$id', params: { id: canvasId } });
				return;
			}

			if (resource.type === 'board') {
				void navigate({
					to: '/canvas/$id/board/$boardId',
					params: { id: canvasId, boardId: resource.id },
				});
				return;
			}

			if (resource.type === 'prototype') {
				void navigate({
					to: '/canvas/$id/prototype/$prototypeId',
					params: { id: canvasId, prototypeId: resource.id },
				});
				return;
			}

			if (resource.type === 'document') {
				void navigate({
					to: '/canvas/$id/document/$documentId',
					params: { id: canvasId, documentId: resource.id },
				});
			}
		},
		[canvasId, navigate],
	);

	const flushQueuedSave = useCallback(async () => {
		if (saveInFlightRef.current) return;

		saveInFlightRef.current = true;

		try {
			while (queuedCanvasDataRef.current) {
				const nextCanvasData = queuedCanvasDataRef.current;
				queuedCanvasDataRef.current = null;

				const headers = await getRequiredAuthHeaders(getToken);
				const response = await api.api.canvas[':id'].$put(
					{
						param: { id: canvasId },
						json: {
							...nextCanvasData,
							expectedVersion: versionRef.current,
						},
					},
					{ headers },
				);

				if (!response.ok) {
					throw new Error(await response.text());
				}

				const result = (await response.json()) as { version: number };
				versionRef.current = result.version;
			}
		} catch {
			queuedCanvasDataRef.current = null;
		} finally {
			saveInFlightRef.current = false;
		}
	}, [canvasId, getToken]);

	const queueSave = useCallback(
		(nextElements: readonly ExcalidrawElement[]) => {
			queuedCanvasDataRef.current = buildPersistedCanvasData(
				nextElements,
				appStateRef.current,
				filesRef.current,
			);

			if (!saveInFlightRef.current) {
				void flushQueuedSave();
			}
		},
		[flushQueuedSave],
	);

	const handleBoardChange = useCallback(
		(elementId: string, nextBoard: KanbanOverlayCustomData) => {
			let nextElements: readonly ExcalidrawElement[] = sceneElementsRef.current;

			nextElements = sceneElementsRef.current.map((candidate) =>
				candidate.id === elementId
					? bumpElementVersion({
							...candidate,
							customData: nextBoard,
						})
					: candidate,
			);

			sceneElementsRef.current = nextElements;
			setSceneElements(nextElements);
			queueSave(nextElements);
		},
		[queueSave],
	);

	if (!activeBoardElement) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Board not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{boardElements.length === 0
							? 'This canvas does not currently have any board cards.'
							: 'The requested board could not be found. Try reopening it from the canvas.'}
					</p>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</Link>
				</div>
			</div>
		);
	}

	return (
		<ProjectShell
			projectId={canvasId}
			projectName={canvasTitle}
			canvasId={canvasId}
			resources={resources}
			activeResourceId={activeBoardElement.id}
			collaboration={collaboration}
			onNavigateToResource={handleNavigateToResource}
		>
			<div className="flex h-full min-h-0 flex-col bg-[var(--color-canvas-bg)]">
				<FocusedViewHeader
					projectName={canvasTitle}
					resourceName={activeBoardElement.customData.title ?? 'Untitled Board'}
					canvasId={canvasId}
				/>

				<div className="min-h-0 flex-1 p-4">
					<div className="h-full min-h-0 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.28)]">
						<KanbanBoardContainer
							element={activeBoardElement}
							mode="shell"
							isSelected
							isActive
							onChange={handleBoardChange}
							onActivityChange={undefined}
						/>
					</div>
				</div>
			</div>
		</ProjectShell>
	);
}

export function BoardStudioPage({ canvasId, boardId }: BoardStudioPageProps) {
	const { getToken } = useAuth();
	const canvasQuery = useQuery({
		queryKey: ['canvas', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!res.ok) throw new Error('Failed to load canvas');
			return res.json();
		},
		refetchOnMount: 'always',
	});
	const boardQuery = useQuery({
		queryKey: ['heavy-resource', canvasId, 'board', boardId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await fetch(toApiUrl(`/api/canvas/${canvasId}/resources/board/${boardId}`), {
				headers,
			});
			if (!res.ok) throw new Error(await res.text());
			return (await res.json()) as HeavyResourceRecord;
		},
	});

	const canvasData = canvasQuery.data as CanvasQueryData | undefined;
	const canvasTitle =
		typeof canvasData?.canvas?.title === 'string' ? canvasData.canvas.title : 'Untitled Project';
	const canvasVersion =
		typeof canvasData?.canvas?.version === 'number' && canvasData.canvas.version > 0
			? canvasData.canvas.version
			: 1;

	const normalizedElements = useMemo(
		() =>
			normalizeSceneElements(
				(canvasData?.data?.elements ?? []) as unknown as readonly ExcalidrawElement[],
			),
		[canvasData?.data?.elements],
	);
	const boardResource = boardQuery.data ?? null;
	const normalizedBoard = useMemo(
		() =>
			boardResource ? normalizeKanbanOverlay(boardResource.data as KanbanOverlayCustomData) : null,
		[boardResource],
	);
	const mergedElements = useMemo(
		() =>
			normalizedBoard
				? normalizedElements.map((element) =>
						element.id === boardId
							? {
									...element,
									customData: normalizedBoard,
								}
							: element,
					)
				: normalizedElements,
		[boardId, normalizedBoard, normalizedElements],
	);
	const boardElements = useMemo(() => getOpenBoardElements(mergedElements), [mergedElements]);
	const matchedBoardElement = useMemo(
		() => boardElements.find((element) => element.id === boardId) ?? null,
		[boardElements, boardId],
	);
	const fallbackBoardElement = useMemo(
		() => (matchedBoardElement ? null : (boardElements[0] ?? null)),
		[boardElements, matchedBoardElement],
	);

	if (canvasQuery.isLoading || boardQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
			</div>
		);
	}

	if (canvasQuery.isError || boardQuery.isError) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Failed to load board</div>
					<p className="mt-2 text-sm text-stone-600">
						{boardQuery.isError
							? 'The requested board could not be loaded from its resource record.'
							: 'The canvas data could not be loaded for this board view.'}
					</p>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</Link>
				</div>
			</div>
		);
	}

	if (!matchedBoardElement && fallbackBoardElement) {
		return (
			<Navigate
				to="/canvas/$id/board/$boardId"
				params={{
					id: canvasId,
					boardId: fallbackBoardElement.id,
				}}
				replace
			/>
		);
	}

	if (!canvasData?.data || !matchedBoardElement) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Board not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{boardElements.length === 0
							? 'This canvas does not currently have any board cards.'
							: 'The requested board could not be found. Try reopening it from the canvas.'}
					</p>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</Link>
				</div>
			</div>
		);
	}

	return (
		<BoardStudioWorkspace
			key={matchedBoardElement.id}
			canvasId={canvasId}
			canvasTitle={canvasTitle}
			boardElement={matchedBoardElement}
			initialElements={mergedElements}
			initialAppState={(canvasData.data.appState ?? {}) as Record<string, unknown>}
			initialFiles={canvasData.data.files ?? null}
			initialVersion={canvasVersion}
		/>
	);
}
