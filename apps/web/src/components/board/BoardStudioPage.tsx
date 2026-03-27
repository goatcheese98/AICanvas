import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { ProjectShell } from '@/components/shell';
import type { ProjectResource } from '@/components/shell/types';
import { KanbanBoard } from '@/components/overlays/kanban';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useAppStore } from '@/stores/store';

interface BoardStudioPageProps {
	canvasId: string;
	boardId: string;
}

export function BoardStudioPage({ canvasId, boardId }: BoardStudioPageProps) {
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const addToast = useAppStore((s) => s.addToast);

	const collaboration = useCollaboration({
		onError: (message: string) => addToast({ message, type: 'error' }),
	});

	const canvasQuery = useQuery({
		queryKey: ['canvas', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const res = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!res.ok) throw new Error('Failed to load canvas');
			return res.json();
		},
	});

	const elements = useMemo(
		() =>
			normalizeSceneElements(
				(canvasQuery.data?.data?.elements ?? []) as unknown as ExcalidrawElement[],
			),
		[canvasQuery.data?.data?.elements],
	);

	// Extract board and prototype resources from canvas elements
	const resources: ProjectResource[] = useMemo(() => {
		const canvasResource: ProjectResource = {
			id: canvasId,
			type: 'canvas',
			name: 'Overview',
			isActive: false,
		};

		const overlayResources: ProjectResource[] = [];

		for (const el of elements) {
			if (el.isDeleted) continue;
			const customData = el.customData as { type?: string; title?: string } | undefined;
			if (customData?.type === 'kanban') {
				overlayResources.push({
					id: el.id,
					type: 'board',
					name: customData?.title || 'Untitled Board',
					isActive: el.id === boardId,
				});
			} else if (customData?.type === 'prototype') {
				overlayResources.push({
					id: el.id,
					type: 'prototype',
					name: customData?.title || 'Untitled Prototype',
					isActive: false,
				});
			}
		}

		return [canvasResource, ...overlayResources];
	}, [elements, canvasId, boardId]);

	const kanbanElements = useMemo(
		() =>
			elements.filter(
				(element) => (element.customData as { type?: unknown } | undefined)?.type === 'kanban',
			),
		[elements],
	);

	const matchedBoardElement = useMemo(
		() => kanbanElements.find((element) => element.id === boardId) ?? null,
		[kanbanElements, boardId],
	);

	const fallbackBoardElement = useMemo(
		() => (matchedBoardElement ? null : (kanbanElements[0] ?? null)),
		[matchedBoardElement, kanbanElements],
	);

	const boardElement = matchedBoardElement ?? fallbackBoardElement;

	const normalizedBoard = useMemo(
		() =>
			boardElement
				? normalizeKanbanOverlay(boardElement.customData as KanbanOverlayCustomData)
				: null,
		[boardElement],
	);

	const handleNavigateToResource = (resource: ProjectResource) => {
		if (resource.type === 'canvas') {
			void navigate({
				to: '/canvas/$id',
				params: { id: canvasId },
			});
			return;
		}
		if (resource.type === 'board') {
			void navigate({
				to: '/canvas/$id/board/$boardId' as never,
				params: { id: canvasId, boardId: resource.id } as never,
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
	};

	if (canvasQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
			</div>
		);
	}

	if (canvasQuery.isError) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Failed to load board</div>
					<p className="mt-2 text-sm text-stone-600">
						The canvas data could not be loaded for this board view.
					</p>
					<button
						type="button"
						onClick={() =>
							void navigate({
								to: '/canvas/$id',
								params: { id: canvasId },
							})
						}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</button>
				</div>
			</div>
		);
	}

	if (!matchedBoardElement && fallbackBoardElement) {
		return (
			<Navigate
				to={'/canvas/$id/board/$boardId' as never}
				params={
					{
						id: canvasId,
						boardId: fallbackBoardElement.id,
					} as never
				}
				replace
			/>
		);
	}

	if (!boardElement || !normalizedBoard || !canvasQuery.data?.data) {
		return (
			<div className="flex h-full items-center justify-center bg-stone-50 p-6">
				<div className="rounded-[24px] border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
					<div className="text-lg font-semibold text-stone-900">Board not found</div>
					<p className="mt-2 text-sm text-stone-600">
						{kanbanElements.length === 0
							? 'This canvas does not currently have any kanban boards.'
							: 'The requested board could not be found. Try reopening it from the canvas.'}
					</p>
					<button
						type="button"
						onClick={() =>
							void navigate({
								to: '/canvas/$id',
								params: { id: canvasId },
							})
						}
						className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
					>
						Back to Canvas
					</button>
				</div>
			</div>
		);
	}

	// Create a shell element for the KanbanBoard component
	const shellElement = useMemo(
		() => ({
			id: boardElement.id,
			type: 'rectangle' as const,
			x: 0,
			y: 0,
			width: 1200,
			height: 800,
			backgroundColor: '#f8f6f0',
			fillStyle: 'solid' as const,
			opacity: 100,
			roughness: 1,
			roundness: { type: 1 as const, value: 8 },
			customData: normalizedBoard,
		}),
		[boardElement.id, normalizedBoard],
	);

	return (
		<ProjectShell
			projectId="default"
			projectName={normalizedBoard.title}
			canvasId={canvasId}
			collaboration={collaboration}
			resources={resources}
			onNavigateToResource={handleNavigateToResource}
		>
			<div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#f8f6f0_0%,#ffffff_48%,#eef3ff_100%)]">
				<div className="flex h-full flex-col items-center justify-center p-6">
					<div className="w-full max-w-6xl">
						<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
							<p className="font-medium">Board Studio</p>
							<p className="mt-1 text-amber-700">
								Board editing is temporarily unavailable during Phase 2 transition.
								The board is shown in read-only preview mode.
							</p>
						</div>
						<div className="h-[calc(100vh-12rem)] overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
							{/* Use preview mode for truly read-only behavior */}
							<KanbanBoard
								element={shellElement as never}
								mode="preview"
								isSelected={false}
								isActive={false}
								onChange={() => {
									/* no-op - read only */
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</ProjectShell>
	);
}
