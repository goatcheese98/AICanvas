import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';

interface KanbanCardProps {
	card: KanbanCardType;
	onChange: (updates: Partial<KanbanCardType>) => void;
	onDelete: () => void;
	onDragStart: () => void;
	onDrop: () => void;
}

const priorityStyles = {
	low: 'bg-emerald-100 text-emerald-700',
	medium: 'bg-amber-100 text-amber-700',
	high: 'bg-rose-100 text-rose-700',
} as const;

export function KanbanCard({
	card,
	onChange,
	onDelete,
	onDragStart,
	onDrop,
}: KanbanCardProps) {
	return (
		<div
			draggable
			onDragStart={onDragStart}
			onDragOver={(event) => event.preventDefault()}
			onDrop={(event) => {
				event.preventDefault();
				onDrop();
			}}
			className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
		>
			<div className="mb-2 flex items-start justify-between gap-2">
				<input
					value={card.title}
					onChange={(event) => onChange({ title: event.target.value })}
					className="w-full border-0 bg-transparent text-sm font-semibold text-stone-900 outline-none"
				/>
				<button type="button" onClick={onDelete} className="text-xs text-stone-400 hover:text-rose-600">
					Delete
				</button>
			</div>
			<textarea
				value={card.description ?? ''}
				onChange={(event) => onChange({ description: event.target.value })}
				className="min-h-20 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none"
				placeholder="Details..."
			/>
			<div className="mt-3 flex items-center justify-between gap-2">
				<select
					value={card.priority ?? 'medium'}
					onChange={(event) =>
						onChange({ priority: event.target.value as KanbanCardType['priority'] })
					}
					className="rounded-full border border-stone-300 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-stone-600"
				>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
				<span
					className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
						priorityStyles[card.priority ?? 'medium']
					}`}
				>
					{card.priority ?? 'medium'}
				</span>
			</div>
		</div>
	);
}
