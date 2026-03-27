import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import { KanbanBoard } from '@/components/overlays/kanban';
import { api, getRequiredAuthHeaders } from '@/lib/api';
import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

interface BoardStudioPageProps {
	canvasId: string;
	boardId: string;
}

interface BoardStudioSessionProps {
	canvasId: string;
	boardElementId: string;
	normalizedBoard: KanbanOverlayCustomData;
}

function BoardStudioSession({
	canvasId,
	boardElementId,
	normalizedBoard,
}: BoardStudioSessionProps) {
	const [draft, setDraft] = useState(normalizedBoard);

	const handleDraftChange = useCallback((_elementId: string, data: KanbanOverlayCustomData) => {
		// In Phase 2, board editing is temporarily read-only during the transition
		// The full write path will be restored in a later phase
		setDraft(data);
	}, []);

	// Create a shell element for the KanbanBoard component
	const shellElement = useMemo(
		() => ({
			id: boardElementId,
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
			customData: draft,
		}),
		[boardElementId, draft],
	);

	return (
		<div className="flex h-full min-h-0 flex-col bg-[linear-gradient(135deg,#f8f6f0_0%,#ffffff_48%,#eef3ff_100%)]">
			<div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-6 py-4 backdrop-blur">
				<div>
					<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
						Board Studio
					</div>
					<div className="mt-1 text-sm text-stone-600">
						Board Studio is temporarily read-only during Phase 2 transition.
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-xs font-medium text-amber-600">
						Board editing temporarily unavailable (Phase 2 migration)
					</div>
					<button
						type="button"
						disabled
						className="cursor-not-allowed rounded-full bg-stone-400 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
						title="Board editing is temporarily unavailable during Phase 2 transition"
					>
						Save Disabled
					</button>
					<Link
						to="/canvas/$id"
						params={{ id: canvasId }}
						className="rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
					>
						Back to Canvas
					</Link>
				</div>
			</div>

			<div className="min-h-0 flex-1 p-6">
				<div className="h-full overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
					<KanbanBoard
						element={shellElement as never}
						mode="shell"
						isSelected={true}
						isActive={true}
						onChange={handleDraftChange}
					/>
				</div>
			</div>
		</div>
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
	});

	const elements = useMemo(
		() =>
			normalizeSceneElements(
				(canvasQuery.data?.data?.elements ?? []) as unknown as ExcalidrawElement[],
			),
		[canvasQuery.data?.data?.elements],
	);

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

	const savedSignature = useMemo(
		() => (normalizedBoard ? JSON.stringify(normalizedBoard) : ''),
		[normalizedBoard],
	);

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
		<BoardStudioSession
			key={`${boardElement.id}:${savedSignature}`}
			canvasId={canvasId}
			boardElementId={boardElement.id}
			normalizedBoard={normalizedBoard}
		/>
	);
}
