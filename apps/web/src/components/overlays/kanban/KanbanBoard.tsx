import { useEffect, useMemo, useState } from 'react';
import type { KanbanCard, KanbanColumn, KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';

type KanbanElement = ExcalidrawElement & {
	customData: KanbanOverlayCustomData;
};

interface KanbanBoardProps {
	element: KanbanElement;
	isSelected: boolean;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

const BOARD_THEMES = {
	parchment: {
		boardBg: '#f8f2e6',
		headerBg: 'rgba(255,255,255,0.55)',
	},
	white: {
		boardBg: '#ffffff',
		headerBg: '#f5f5f4',
	},
	blue: {
		boardBg: '#eff6ff',
		headerBg: '#dbeafe',
	},
	green: {
		boardBg: '#f0fdf4',
		headerBg: '#dcfce7',
	},
	rose: {
		boardBg: '#fff1f2',
		headerBg: '#ffe4e6',
	},
} as const;

function createCard(): KanbanCard {
	return {
		id: crypto.randomUUID(),
		title: 'New card',
		description: '',
		priority: 'medium',
	};
}

function moveCard(board: KanbanOverlayCustomData, cardId: string, toColumnId: string, beforeCardId?: string) {
	let draggedCard: KanbanCard | null = null;
	const strippedColumns = board.columns.map((column) => ({
		...column,
		cards: column.cards.filter((card) => {
			if (card.id === cardId) {
				draggedCard = card;
				return false;
			}
			return true;
		}),
	}));

	if (!draggedCard) return board;
	const cardToInsert = draggedCard;

	return {
		...board,
		columns: strippedColumns.map((column) => {
			if (column.id !== toColumnId) return column;
			if (!beforeCardId) {
				return { ...column, cards: [...column.cards, cardToInsert] };
			}
			const nextCards = [...column.cards];
			const targetIndex = nextCards.findIndex((card) => card.id === beforeCardId);
			if (targetIndex === -1) {
				nextCards.push(cardToInsert);
			} else {
				nextCards.splice(targetIndex, 0, cardToInsert);
			}
			return { ...column, cards: nextCards };
		}),
	};
}

export function KanbanBoard({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: KanbanBoardProps) {
	const [board, setBoard] = useState<KanbanOverlayCustomData>(element.customData);
	const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

	useEffect(() => {
		setBoard(element.customData);
	}, [element.customData]);

	useEffect(() => {
		onEditingChange?.(isSelected);
		return () => onEditingChange?.(false);
	}, [isSelected, onEditingChange]);

	const theme = useMemo(
		() => BOARD_THEMES[(board.bgTheme as keyof typeof BOARD_THEMES) ?? 'parchment'] ?? BOARD_THEMES.parchment,
		[board.bgTheme],
	);

	const commit = (nextBoard: KanbanOverlayCustomData) => {
		setBoard(nextBoard);
		onChange(element.id, nextBoard);
	};

	const updateColumn = (columnId: string, updater: (column: KanbanColumn) => KanbanColumn) => {
		commit({
			...board,
			columns: board.columns.map((column) => (column.id === columnId ? updater(column) : column)),
		});
	};

	return (
		<div
			className="flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-stone-300 shadow-xl"
			style={{ background: theme.boardBg }}
		>
			<div
				className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3"
				style={{ background: theme.headerBg }}
			>
				<input
					value={board.title}
					onChange={(event) => commit({ ...board, title: event.target.value })}
					className="w-full border-0 bg-transparent text-base font-semibold text-stone-900 outline-none"
				/>
				<div className="flex items-center gap-2">
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
							onChange={(updates) => updateColumn(column.id, (current) => ({ ...current, ...updates }))}
							onDelete={() =>
								commit({
									...board,
									columns: board.columns.filter((candidate) => candidate.id !== column.id),
								})
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
								commit(moveCard(board, draggedCardId, column.id, beforeCardId));
								setDraggedCardId(null);
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
