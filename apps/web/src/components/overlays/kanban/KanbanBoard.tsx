import { useEffect, useMemo, useRef, useState } from 'react';
import type { KanbanCard, KanbanColumn, KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';
import {
	cloneKanbanBoard,
	moveKanbanCard,
	normalizeKanbanBoard,
	pushKanbanHistory,
} from './kanban-utils';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_SURFACE_SOFT,
	KANBAN_ACCENT_SURFACE_STRONG,
	KANBAN_ACCENT_TEXT,
} from './kanban-theme';

type KanbanElement = ExcalidrawElement & {
	customData: KanbanOverlayCustomData;
};

interface KanbanBoardProps {
	element: KanbanElement;
	isSelected: boolean;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

const KANBAN_FONT_FAMILY = 'var(--font-sans)';
const KANBAN_FONT_SIZE = 14;
const KANBAN_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const KANBAN_BUTTON_STYLE = {
	borderColor: 'var(--color-border)',
	background: 'var(--color-surface-strong)',
	color: 'var(--color-text-secondary)',
};
const KANBAN_BUTTON_HOVER_STYLE = {
	borderColor: KANBAN_ACCENT_BORDER,
	background: KANBAN_ACCENT_SURFACE,
	color: KANBAN_ACCENT_TEXT,
};

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
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		setBoard(normalizeKanbanBoard(element.customData));
	}, [element.customData]);

	useEffect(() => {
		if (lastReportedEditingRef.current === isSelected) return;
		lastReportedEditingRef.current = isSelected;
		onEditingChangeRef.current?.(isSelected);
	}, [isSelected]);

	useEffect(
		() => () => {
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[],
	);

	useEffect(() => {
		if (!isSelected) {
			setPendingDeleteColumnId(null);
		}
	}, [isSelected]);
	const boardCardCount = useMemo(
		() => board.columns.reduce((total, column) => total + column.cards.length, 0),
		[board.columns],
	);

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
			backgroundColor={element.backgroundColor}
			className="flex h-full min-h-0 flex-col"
			style={{
				fontFamily: KANBAN_FONT_FAMILY,
				backgroundImage:
					`linear-gradient(180deg, ${KANBAN_ACCENT_SURFACE_SOFT} 0%, color-mix(in srgb, var(--color-surface-strong) 96%, white) 100%)`,
			}}
		>
			<div
				className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
				style={{
					borderColor: 'var(--color-border)',
					background:
						`linear-gradient(180deg, ${KANBAN_ACCENT_SURFACE_STRONG} 0%, color-mix(in srgb, var(--color-surface) 94%, white) 100%)`,
				}}
			>
				<div className="min-w-52 flex-1">
					<div
						className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
						style={{ color: 'var(--color-text-tertiary)' }}
					>
						Board
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							value={board.title}
							onChange={(event) => {
								const next = { ...board, title: event.target.value };
								const normalized = normalizeKanbanBoard(next);
								setBoard(normalized);
								onChange(element.id, normalized);
							}}
							className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold outline-none"
							style={{ color: 'var(--color-text-primary)' }}
						/>
						<span
							className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
							style={{
								borderColor: KANBAN_ACCENT_BORDER,
								background: KANBAN_ACCENT_SURFACE,
								color: KANBAN_ACCENT_TEXT,
							}}
						>
							{board.columns.length} columns / {boardCardCount} cards
						</span>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={handleUndo}
						disabled={undoStackRef.current.length === 0}
						className={KANBAN_BUTTON}
						style={KANBAN_BUTTON_STYLE}
						onMouseEnter={(event) => Object.assign(event.currentTarget.style, KANBAN_BUTTON_HOVER_STYLE)}
						onMouseLeave={(event) => Object.assign(event.currentTarget.style, KANBAN_BUTTON_STYLE)}
					>
						Undo
					</button>
					<button
						type="button"
						onClick={handleRedo}
						disabled={redoStackRef.current.length === 0}
						className={KANBAN_BUTTON}
						style={KANBAN_BUTTON_STYLE}
						onMouseEnter={(event) => Object.assign(event.currentTarget.style, KANBAN_BUTTON_HOVER_STYLE)}
						onMouseLeave={(event) => Object.assign(event.currentTarget.style, KANBAN_BUTTON_STYLE)}
					>
						Redo
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
						className={KANBAN_BUTTON}
						style={{
							borderColor: KANBAN_ACCENT_BORDER,
							background: KANBAN_ACCENT_SURFACE,
							color: KANBAN_ACCENT_TEXT,
						}}
					>
						Add column
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-3">
				<div className="flex h-full min-w-full gap-3">
					{board.columns.map((column) => (
						<KanbanColumnView
							key={column.id}
							column={column}
							fontSize={KANBAN_FONT_SIZE}
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
				<div
					className="border-t px-4 py-3 text-xs"
					style={{
						borderColor: 'var(--color-danger-border)',
						background: 'color-mix(in srgb, var(--color-danger-bg) 82%, white)',
						color: 'var(--color-danger-text)',
					}}
				>
					<div className="flex items-center justify-between gap-3">
						<span>Press delete again on the same column to confirm removal.</span>
						<button
							type="button"
							onClick={() => setPendingDeleteColumnId(null)}
							className={KANBAN_BUTTON}
							style={{
								height: '2rem',
								borderColor: 'var(--color-danger-border)',
								background: 'var(--color-surface-strong)',
								color: 'var(--color-danger-text)',
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			) : null}
		</OverlaySurface>
	);
}
