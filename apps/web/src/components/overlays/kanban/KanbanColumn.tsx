import type { KanbanCard as KanbanCardType, KanbanColumn as KanbanColumnType } from '@ai-canvas/shared/types';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
	column: KanbanColumnType;
	fontFamily?: string;
	fontSize?: number;
	background?: string;
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
	fontFamily,
	fontSize = 13,
	background = 'rgba(245,245,244,0.7)',
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
			className="flex h-full min-w-72 flex-col rounded-[24px] border border-stone-200 bg-stone-100/70 p-3"
			style={{ background, fontFamily }}
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
					className="w-full border-0 bg-transparent font-semibold text-stone-900 outline-none"
					style={{ fontSize: `${fontSize + 1}px` }}
				/>
				<button type="button" onClick={onDelete} className="text-xs text-stone-400 hover:text-rose-600">
					Delete
				</button>
			</div>
			<div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
				{column.cards.map((card) => (
					<KanbanCard
						key={card.id}
						card={card}
						fontFamily={fontFamily}
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
				className="mt-3 rounded-2xl border border-dashed border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-white"
			>
				Add card
			</button>
		</div>
	);
}
