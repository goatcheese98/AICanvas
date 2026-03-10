import type { KanbanCard as KanbanCardType, KanbanColumn as KanbanColumnType } from '@ai-canvas/shared/types';
import { KanbanCard } from './KanbanCard';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_SURFACE_SOFT,
	KANBAN_ACCENT_TEXT,
} from './kanban-theme';

interface KanbanColumnProps {
	column: KanbanColumnType;
	fontSize?: number;
	onChange: (updates: Partial<KanbanColumnType>) => void;
	onDelete: () => void;
	onAddCard: () => void;
	onUpdateCard: (cardId: string, updates: Partial<KanbanCardType>) => void;
	onDeleteCard: (cardId: string) => void;
	onDropCard: (cardId?: string) => void;
	onDragCard: (cardId: string) => void;
}

export function KanbanColumn({
	column,
	fontSize = 14,
	onChange,
	onDelete,
	onAddCard,
	onUpdateCard,
	onDeleteCard,
	onDropCard,
	onDragCard,
}: KanbanColumnProps) {
	return (
		<div
			className="flex h-full min-w-72 flex-col rounded-[18px] border p-3 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.28)]"
			style={{
				borderColor: 'var(--color-border)',
				background:
					`linear-gradient(180deg, ${KANBAN_ACCENT_SURFACE_SOFT} 0%, color-mix(in srgb, var(--color-surface-muted) 94%, white) 100%)`,
			}}
			onDragOver={(event) => event.preventDefault()}
			onDrop={(event) => {
				event.preventDefault();
				onDropCard();
			}}
		>
			<div className="mb-3 flex items-center gap-2">
				<input
					value={column.title}
					onChange={(event) => onChange({ title: event.target.value })}
					className="w-full border-0 bg-transparent font-semibold outline-none"
					style={{ fontSize: `${fontSize + 1}px`, color: 'var(--color-text-primary)' }}
				/>
				<span
					className="inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
					style={{
						borderColor: 'var(--color-border)',
						background: 'var(--color-surface-strong)',
						color: 'var(--color-text-secondary)',
					}}
				>
					{column.cards.length}
				</span>
				<button
					type="button"
					onClick={onDelete}
					className="text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
					style={{ color: 'var(--color-text-tertiary)' }}
					onMouseEnter={(event) => {
						event.currentTarget.style.color = 'var(--color-danger-text)';
					}}
					onMouseLeave={(event) => {
						event.currentTarget.style.color = 'var(--color-text-tertiary)';
					}}
				>
					Delete
				</button>
			</div>
			<div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
				{column.cards.map((card) => (
					<KanbanCard
						key={card.id}
						card={card}
						fontSize={fontSize}
						onChange={(updates) => onUpdateCard(card.id, updates)}
						onDelete={() => onDeleteCard(card.id)}
						onDragStart={() => onDragCard(card.id)}
						onDrop={() => onDropCard(card.id)}
					/>
				))}
			</div>
			<button
				type="button"
				onClick={onAddCard}
				className="mt-3 rounded-[12px] border border-dashed px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors"
				style={{
					borderColor: KANBAN_ACCENT_BORDER,
					background: 'color-mix(in srgb, var(--color-surface-strong) 82%, white)',
					color: KANBAN_ACCENT_TEXT,
				}}
				onMouseEnter={(event) => {
					event.currentTarget.style.background = KANBAN_ACCENT_SURFACE;
				}}
				onMouseLeave={(event) => {
					event.currentTarget.style.background = 'color-mix(in srgb, var(--color-surface-strong) 82%, white)';
				}}
			>
				Add card
			</button>
		</div>
	);
}
