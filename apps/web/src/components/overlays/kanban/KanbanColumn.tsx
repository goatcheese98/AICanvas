import type { DragEvent } from 'react';
import type {
	KanbanCard as KanbanCardType,
	KanbanColumn as KanbanColumnType,
} from '@ai-canvas/shared/types';
import { KanbanCard } from './KanbanCard';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_TEXT,
} from './kanban-theme';
import { getProjectedOverCardId } from './kanban-utils';

interface KanbanColumnProps {
	column: KanbanColumnType;
	fontSize?: number;
	columnBackground: string;
	cardBackground: string;
	borderTone: string;
	isCardOver: boolean;
	draggingCardId: string | null;
	draggingFromColumnId: string | null;
	draggingColumnId: string | null;
	overCardId: string | null;
	onChange: (updates: Partial<KanbanColumnType>) => void;
	onRequestDelete: () => void;
	onAddCard: () => void;
	onUpdateCard: (cardId: string, updates: Partial<KanbanCardType>) => void;
	onDeleteCard: (cardId: string) => void;
	onCardDragStart: (
		event: DragEvent<HTMLButtonElement>,
		cardId: string,
		columnId: string,
	) => void;
	onCardDragEnd: () => void;
	onCardColumnDragOver: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
	onCardColumnDrop: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
	onCardDragEnter: (cardId: string, columnId: string, event: DragEvent<HTMLDivElement>) => void;
	onColumnDragStart: (event: DragEvent<HTMLButtonElement>, columnId: string) => void;
	onColumnDragEnd: () => void;
	onColumnReorderDragOver: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
	onColumnReorderDrop: (event: DragEvent<HTMLElement>) => void;
}

export function KanbanColumn({
	column,
	fontSize = 14,
	columnBackground,
	cardBackground,
	borderTone,
	isCardOver,
	draggingCardId,
	draggingFromColumnId,
	draggingColumnId,
	overCardId,
	onChange,
	onRequestDelete,
	onAddCard,
	onUpdateCard,
	onDeleteCard,
	onCardDragStart,
	onCardDragEnd,
	onCardColumnDragOver,
	onCardColumnDrop,
	onCardDragEnter,
	onColumnDragStart,
	onColumnDragEnd,
	onColumnReorderDragOver,
	onColumnReorderDrop,
}: KanbanColumnProps) {
	const isColumnDragging = draggingColumnId === column.id;

	return (
		<div
			onDragOver={(event) => {
				if (draggingColumnId) {
					onColumnReorderDragOver(event, column.id);
					return;
				}
				onCardColumnDragOver(event, column.id);
			}}
			onDrop={(event) => {
				if (draggingColumnId) {
					onColumnReorderDrop(event);
					return;
				}
				onCardColumnDrop(event, column.id);
			}}
			className="group flex min-w-[19rem] max-w-[19rem] self-start flex-col rounded-[22px] border p-3 transition-all"
			style={{
				borderColor: isCardOver ? KANBAN_ACCENT_BORDER : borderTone,
				background: columnBackground,
				boxShadow: isCardOver
					? '0 0 0 2px color-mix(in srgb, var(--color-accent-border) 26%, transparent)'
					: '0 16px 34px -30px rgba(15,23,42,0.18)',
				opacity: isColumnDragging ? 0.7 : 1,
			}}
		>
			<div className="flex items-center gap-3">
				<div className="min-w-0 flex-1">
					<input
						value={column.title}
						onChange={(event) => onChange({ title: event.target.value })}
						className="w-full border-0 bg-transparent px-0 py-0.5 text-[16px] font-semibold outline-none"
						style={{ color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
						placeholder="Column title"
					/>
					<div className="mt-1 flex items-center gap-2">
						<span
							className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
							style={{
								borderColor: 'var(--color-border)',
								background: 'color-mix(in srgb, var(--color-surface-strong) 90%, white)',
								color: 'var(--color-text-secondary)',
							}}
						>
							{column.cards.length} card{column.cards.length === 1 ? '' : 's'}
						</span>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						type="button"
						draggable
						onDragStart={(event) => onColumnDragStart(event, column.id)}
						onDragEnd={onColumnDragEnd}
						className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border transition-colors"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-strong) 90%, white)',
							color: 'var(--color-text-tertiary)',
							cursor: 'grab',
						}}
						aria-label={`Drag ${column.title}`}
						title="Drag column"
					>
						<span className="grid grid-cols-2 gap-[2px]">
							{Array.from({ length: 6 }, (_, index) => (
								<span
									key={index}
									className="h-[4px] w-[4px] rounded-full"
									style={{ background: 'currentColor' }}
								/>
							))}
						</span>
					</button>

					<button
						type="button"
						onClick={onRequestDelete}
						className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border transition-colors"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-strong) 90%, white)',
							color: 'var(--color-text-tertiary)',
						}}
						aria-label={`Delete ${column.title}`}
						title="Delete column"
					>
						×
					</button>
				</div>
			</div>

			<div
				className="mt-3 h-px rounded-full"
				style={{ background: 'color-mix(in srgb, var(--color-border) 86%, transparent)' }}
			/>

			<div className="mt-3 space-y-3">
				{column.cards.map((card) => {
					const projectedCardId =
						isCardOver && draggingCardId
							? overCardId ?? null
							: null;
					const showReturnCue =
						Boolean(draggingCardId) &&
						draggingFromColumnId === column.id &&
						projectedCardId === getProjectedOverCardId(column.cards, card.id, false);

					return (
						<KanbanCard
							key={card.id}
							card={card}
							fontSize={fontSize}
							cardBackground={cardBackground}
							isDragging={draggingCardId === card.id}
							showReturnCue={showReturnCue}
							onChange={(updates) => onUpdateCard(card.id, updates)}
							onDelete={() => onDeleteCard(card.id)}
							onDragStart={(event) => onCardDragStart(event, card.id, column.id)}
							onDragEnd={onCardDragEnd}
							onDragOverCard={(event) => onCardDragEnter(card.id, column.id, event)}
						/>
					);
				})}
			</div>

			<button
				type="button"
				onClick={onAddCard}
				className="mt-3 inline-flex w-full items-center justify-center rounded-[16px] border border-dashed px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors"
				style={{
					borderColor: KANBAN_ACCENT_BORDER,
					background: 'color-mix(in srgb, var(--color-surface-strong) 88%, white)',
					color: KANBAN_ACCENT_TEXT,
				}}
			>
				Add card
			</button>
		</div>
	);
}
