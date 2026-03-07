import { useEffect, useMemo, useRef, useState } from 'react';
import type { KanbanCard, KanbanColumn, KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';
import {
	BOARD_FONTS,
	BOARD_THEMES,
	cloneKanbanBoard,
	moveKanbanCard,
	normalizeKanbanBoard,
	pushKanbanHistory,
} from './kanban-utils';

type KanbanElement = ExcalidrawElement & {
	customData: KanbanOverlayCustomData;
};

interface KanbanBoardProps {
	element: KanbanElement;
	isSelected: boolean;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

function createCard(): KanbanCard {
	return {
		id: crypto.randomUUID(),
		title: 'New card',
		description: '',
		priority: 'medium',
	};
}

export function KanbanBoard({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: KanbanBoardProps) {
	const [board, setBoard] = useState<KanbanOverlayCustomData>(() => normalizeKanbanBoard(element.customData));
	const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
	const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
	const undoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const redoStackRef = useRef<KanbanOverlayCustomData[]>([]);

	useEffect(() => {
		setBoard(normalizeKanbanBoard(element.customData));
	}, [element.customData]);

	useEffect(() => {
		onEditingChange?.(isSelected);
		return () => onEditingChange?.(false);
	}, [isSelected, onEditingChange]);

	useEffect(() => {
		if (!isSelected) {
			setPendingDeleteColumnId(null);
		}
	}, [isSelected]);

	const theme = useMemo(
		() => BOARD_THEMES[(board.bgTheme as keyof typeof BOARD_THEMES) ?? 'parchment'] ?? BOARD_THEMES.parchment,
		[board.bgTheme],
	);
	const fontFamily =
		BOARD_FONTS[(board.fontId as keyof typeof BOARD_FONTS) ?? 'excalifont'] ?? BOARD_FONTS.excalifont;
	const fontSize = board.fontSize ?? 13;

	const commit = (nextBoard: KanbanOverlayCustomData) => {
		undoStackRef.current = pushKanbanHistory(undoStackRef.current, board);
		redoStackRef.current = [];
		const normalized = normalizeKanbanBoard(nextBoard);
		setBoard(normalized);
		onChange(element.id, normalized);
	};

	const updateColumn = (columnId: string, updater: (column: KanbanColumn) => KanbanColumn) => {
		commit({
			...board,
			columns: board.columns.map((column) => (column.id === columnId ? updater(column) : column)),
		});
	};

	const handleUndo = () => {
		const previous = undoStackRef.current.at(-1);
		if (!previous) return;
		undoStackRef.current = undoStackRef.current.slice(0, -1);
		redoStackRef.current = pushKanbanHistory(redoStackRef.current, board);
		const next = cloneKanbanBoard(previous);
		setBoard(next);
		onChange(element.id, next);
	};

	const handleRedo = () => {
		const nextFromRedo = redoStackRef.current.at(-1);
		if (!nextFromRedo) return;
		redoStackRef.current = redoStackRef.current.slice(0, -1);
		undoStackRef.current = pushKanbanHistory(undoStackRef.current, board);
		const next = cloneKanbanBoard(nextFromRedo);
		setBoard(next);
		onChange(element.id, next);
	};

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			backgroundColor={theme.boardBg}
			className="flex h-full min-h-0 flex-col"
			style={{ fontFamily }}
		>
			<div
				className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3"
				style={{ background: theme.headerBg }}
			>
				<input
					value={board.title}
					onChange={(event) => {
						const next = { ...board, title: event.target.value };
						const normalized = normalizeKanbanBoard(next);
						setBoard(normalized);
						onChange(element.id, normalized);
					}}
					className="min-w-52 flex-1 border-0 bg-transparent text-base font-semibold text-stone-900 outline-none"
				/>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={handleUndo}
						disabled={undoStackRef.current.length === 0}
						className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={handleRedo}
						disabled={redoStackRef.current.length === 0}
						className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Redo
					</button>
					<select
						value={board.bgTheme ?? 'parchment'}
						onChange={(event) => commit({ ...board, bgTheme: event.target.value })}
						className="rounded-full border border-stone-300 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-stone-600"
					>
						{Object.keys(BOARD_THEMES).map((themeId) => (
							<option key={themeId} value={themeId}>
								{themeId}
							</option>
						))}
					</select>
					<select
						value={board.fontId ?? 'excalifont'}
						onChange={(event) => commit({ ...board, fontId: event.target.value })}
						className="rounded-full border border-stone-300 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-stone-600"
					>
						{Object.keys(BOARD_FONTS).map((fontId) => (
							<option key={fontId} value={fontId}>
								{fontId}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={() => commit({ ...board, fontSize: Math.max(11, (board.fontSize ?? 13) - 1) })}
						className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
					>
						A-
					</button>
					<button
						type="button"
						onClick={() => commit({ ...board, fontSize: Math.min(20, (board.fontSize ?? 13) + 1) })}
						className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
					>
						A+
					</button>
					<button
						type="button"
						onClick={() =>
							commit({
								...board,
								columns: [
									...board.columns,
									{ id: crypto.randomUUID(), title: 'New Column', cards: [] },
								],
							})
						}
						className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700"
					>
						Add column
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-4">
				<div className="flex h-full min-w-full gap-4">
					{board.columns.map((column) => (
						<KanbanColumnView
							key={column.id}
							column={column}
							fontFamily={fontFamily}
							fontSize={fontSize}
							background={theme.columnBg}
							onChange={(updates) => updateColumn(column.id, (current) => ({ ...current, ...updates }))}
							onDelete={() =>
								pendingDeleteColumnId === column.id
									? commit({
											...board,
											columns: board.columns.filter((candidate) => candidate.id !== column.id),
										})
									: setPendingDeleteColumnId(column.id)
							}
							onAddCard={() =>
								updateColumn(column.id, (current) => ({
									...current,
									cards: [...current.cards, createCard()],
								}))
							}
							onUpdateCard={(cardId, updates) =>
								updateColumn(column.id, (current) => ({
									...current,
									cards: current.cards.map((card) => (card.id === cardId ? { ...card, ...updates } : card)),
								}))
							}
							onDeleteCard={(cardId) =>
								updateColumn(column.id, (current) => ({
									...current,
									cards: current.cards.filter((card) => card.id !== cardId),
								}))
							}
							onDragCard={(cardId) => setDraggedCardId(cardId)}
							onDropCard={(beforeCardId) => {
								if (!draggedCardId) return;
								commit(moveKanbanCard(board, draggedCardId, column.id, beforeCardId));
								setDraggedCardId(null);
							}}
						/>
					))}
				</div>
			</div>

			{pendingDeleteColumnId ? (
				<div className="border-t border-stone-200 bg-white/80 px-4 py-3 text-xs text-stone-600">
					<div className="flex items-center justify-between gap-3">
						<span>Press delete again on the same column to confirm removal.</span>
						<button
							type="button"
							onClick={() => setPendingDeleteColumnId(null)}
							className="rounded-full border border-stone-300 px-3 py-1 font-semibold uppercase tracking-[0.18em] text-stone-700"
						>
							Cancel
						</button>
					</div>
				</div>
			) : null}
		</OverlaySurface>
	);
}
