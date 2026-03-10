import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_TEXT,
} from './kanban-theme';

interface KanbanCardProps {
	card: KanbanCardType;
	fontSize?: number;
	onChange: (updates: Partial<KanbanCardType>) => void;
	onDelete: () => void;
	onDragStart: () => void;
	onDrop: () => void;
}

const priorityStyles = {
	low: {
		background: 'var(--color-success-bg)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 18%, transparent)',
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

export function KanbanCard({
	card,
	fontSize = 14,
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
			className="rounded-[14px] border p-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)]"
			style={{
				borderColor: 'var(--color-border)',
				background: 'var(--color-surface-strong)',
			}}
		>
			<div className="mb-2 flex items-start justify-between gap-2">
				<input
					value={card.title}
					onChange={(event) => onChange({ title: event.target.value })}
					className="w-full border-0 bg-transparent font-semibold outline-none"
					style={{ fontFamily: 'var(--font-sans)', fontSize: `${fontSize}px`, color: 'var(--color-text-primary)' }}
				/>
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
			<textarea
				value={card.description ?? ''}
				onChange={(event) => onChange({ description: event.target.value })}
				className="min-h-20 w-full resize-none rounded-[12px] border px-3 py-2 text-xs outline-none transition-colors"
				placeholder="Details..."
				style={{
					fontFamily: 'var(--font-sans)',
					fontSize: `${Math.max(fontSize - 1, 12)}px`,
					borderColor: 'var(--color-border)',
					background: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)',
					color: 'var(--color-text-secondary)',
				}}
				onFocus={(event) => {
					event.currentTarget.style.borderColor = 'var(--color-accent-border)';
					event.currentTarget.style.background = 'var(--color-surface-strong)';
				}}
				onBlur={(event) => {
					event.currentTarget.style.borderColor = 'var(--color-border)';
					event.currentTarget.style.background =
						'color-mix(in srgb, var(--color-surface-muted) 92%, white)';
				}}
			/>
			<div className="mt-3 flex items-center justify-between gap-2">
				<select
					value={card.priority ?? 'medium'}
					onChange={(event) =>
						onChange({ priority: event.target.value as KanbanCardType['priority'] })
					}
					className="rounded-[10px] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] outline-none"
					style={{
						borderColor: 'var(--color-border)',
						background: 'var(--color-surface-strong)',
						color: 'var(--color-text-secondary)',
					}}
				>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
				<span
					className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
					style={priorityStyles[card.priority ?? 'medium']}
				>
					{card.priority ?? 'medium'}
				</span>
			</div>
		</div>
	);
}
