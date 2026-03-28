import { OverlaySurface } from '@/components/overlays/overlay-surface';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useMemo } from 'react';
import { KANBAN_ACCENT_BORDER, KANBAN_ACCENT_SURFACE, KANBAN_ACCENT_TEXT } from './kanban-theme';

interface KanbanPreviewCardProps {
	element: ExcalidrawElement & { customData: KanbanOverlayCustomData };
	isSelected: boolean;
}

const PREVIEW_PRIORITY_META = {
	low: {
		background: 'var(--color-success-bg)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 20%, transparent)',
		color: 'var(--color-success-text)',
	},
	medium: {
		background: KANBAN_ACCENT_SURFACE,
		borderColor: KANBAN_ACCENT_BORDER,
		color: KANBAN_ACCENT_TEXT,
	},
	high: {
		background: 'var(--color-danger-bg)',
		borderColor: 'var(--color-danger-border)',
		color: 'var(--color-danger-text)',
	},
} as const;

function countTotalCards(board: KanbanOverlayCustomData): number {
	return board.columns.reduce((total, column) => total + column.cards.length, 0);
}

function countOverdueCards(board: KanbanOverlayCustomData): number {
	return board.columns.reduce(
		(total, column) =>
			total +
			column.cards.filter((card) => {
				if (!card.dueDate) return false;
				const parsed = new Date(`${card.dueDate}T23:59:59`);
				return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
			}).length,
		0,
	);
}

export function KanbanPreviewCard({ element, isSelected }: KanbanPreviewCardProps) {
	const board = element.customData;
	const snapshot = board.resourceSnapshot;
	const displayTitle = snapshot?.title ?? board.title;
	const displayBadge = snapshot?.display?.badge;
	const displaySummary = snapshot?.display?.summary;
	const cardCount = useMemo(() => countTotalCards(board), [board]);
	const overdueCount = useMemo(() => countOverdueCards(board), [board]);

	return (
		<OverlaySurface element={element} isSelected={isSelected} className="flex h-full flex-col">
			<div className="flex h-full flex-col bg-white">
				{/* Header */}
				<div className="flex min-h-14 items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-3">
					<div className="min-w-0 flex-1">
						{displayTitle ? (
							<div className="truncate font-semibold text-stone-900">{displayTitle}</div>
						) : (
							<div className="truncate text-sm italic text-stone-400">Untitled board</div>
						)}
						{displaySummary ? (
							<div className="truncate text-xs text-stone-500">{displaySummary}</div>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						{displayBadge ? (
							<div className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								{displayBadge}
							</div>
						) : null}
						<div className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
							{cardCount} card{cardCount !== 1 ? 's' : ''}
						</div>
					</div>
				</div>

				{/* Content preview */}
				<div className="min-h-0 flex-1 px-4 py-4">
					{board.columns.length > 0 ? (
						<div className="space-y-3">
							{board.columns.slice(0, 3).map((column) => (
								<div
									key={column.id}
									className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2.5"
								>
									<div className="mb-2 flex items-center justify-between gap-2">
										<span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">
											{column.title}
										</span>
										<span className="shrink-0 rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
											{column.cards.length}
										</span>
									</div>
									{column.cards.length > 0 ? (
										<div className="space-y-1.5">
											{column.cards.slice(0, 2).map((card) => {
												const priority = PREVIEW_PRIORITY_META[card.priority ?? 'medium'];
												const checklist = card.checklist ?? [];
												const doneCount = checklist.filter((item) => item.done).length;
												return (
													<div
														key={card.id}
														className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs shadow-sm"
													>
														<div
															className="h-2 w-2 shrink-0 rounded-full"
															style={{ background: priority.color }}
														/>
														<span className="min-w-0 flex-1 truncate text-stone-700">
															{card.title}
														</span>
														{checklist.length > 0 && (
															<span className="shrink-0 text-[10px] text-stone-400">
																{doneCount}/{checklist.length}
															</span>
														)}
													</div>
												);
											})}
											{column.cards.length > 2 && (
												<div className="text-center text-[10px] text-stone-400">
													+{column.cards.length - 2} more
												</div>
											)}
										</div>
									) : (
										<div className="text-xs italic text-stone-400">No cards</div>
									)}
								</div>
							))}
							{board.columns.length > 3 && (
								<div className="text-center text-xs text-stone-400">
									+{board.columns.length - 3} more columns
								</div>
							)}
						</div>
					) : (
						<div className="flex h-full items-center justify-center">
							<p className="text-sm italic text-stone-400">No columns</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between gap-3 border-t border-stone-200/80 px-4 py-3">
					<div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
						<span>
							{board.columns.length} column{board.columns.length !== 1 ? 's' : ''}
						</span>
						{overdueCount > 0 && <span>{overdueCount} overdue</span>}
					</div>
					<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
						Double-click to open
					</div>
				</div>
			</div>
		</OverlaySurface>
	);
}
