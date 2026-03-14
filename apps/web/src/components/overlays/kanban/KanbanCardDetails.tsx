import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import { parseLabelInput } from './kanban-card-helpers';
import { KANBAN_ACCENT_BORDER } from './kanban-theme';
import { KanbanChecklistEditor } from './KanbanChecklistEditor';

const PRIORITY_META = {
	low: {
		label: 'Low',
		background: 'var(--color-success-bg)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 20%, transparent)',
		color: 'var(--color-success-text)',
	},
	medium: {
		label: 'Medium',
		background: 'color-mix(in srgb, var(--color-accent-bg) 16%, white)',
		borderColor: KANBAN_ACCENT_BORDER,
		color: 'color-mix(in srgb, var(--color-accent-text) 24%, var(--color-text-secondary))',
	},
	high: {
		label: 'High',
		background: 'var(--color-danger-bg)',
		borderColor: 'var(--color-danger-border)',
		color: 'var(--color-danger-text)',
	},
} as const;

interface KanbanCardDetailsProps {
	card: KanbanCardType;
	cardRadius: number;
	controlRadius: number;
	onChange: (updates: Partial<KanbanCardType>) => void;
}

export function KanbanCardDetails({
	card,
	cardRadius,
	controlRadius,
	onChange,
}: KanbanCardDetailsProps) {
	const priority = card.priority ?? 'medium';
	const labelValue = (card.labels ?? []).join(', ');

	return (
		<div
			className="mt-3 border p-4 transition-all"
			style={{
				borderRadius: `${Math.max(cardRadius - 4, 0)}px`,
				borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
				backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
				backgroundImage: 'var(--kanban-sketch-card-texture)',
				transitionDuration: 'var(--kanban-motion-duration)',
			}}
		>
			<div className="space-y-4">
				<label className="block min-w-0">
					<div
						className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{ color: 'var(--color-text-tertiary)' }}
					>
						Due date
					</div>
					<input
						type="date"
						value={card.dueDate ?? ''}
						onChange={(event) => onChange({ dueDate: event.target.value || undefined })}
						className="w-full border px-3 py-2 text-xs outline-none"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
							background: 'var(--color-surface-strong)',
							color: 'var(--color-text-primary)',
							fontFamily: 'inherit',
						}}
					/>
				</label>

				<label className="block min-w-0">
					<div
						className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{ color: 'var(--color-text-tertiary)' }}
					>
						Labels
					</div>
					<input
						value={labelValue}
						onChange={(event) => onChange({ labels: parseLabelInput(event.target.value) })}
						maxLength={200}
						className="w-full border px-3 py-2 text-xs outline-none"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
							background: 'var(--color-surface-strong)',
							color: 'var(--color-text-primary)',
							fontFamily: 'inherit',
						}}
						placeholder="design, research, launch"
					/>
				</label>

				<div>
					<div
						className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{ color: 'var(--color-text-tertiary)' }}
					>
						Priority
					</div>
					<div className="grid grid-cols-3 gap-2">
						{(Object.keys(PRIORITY_META) as Array<keyof typeof PRIORITY_META>).map((option) => {
							const meta = PRIORITY_META[option];
							const isActive = option === priority;
							return (
								<button
									key={option}
									type="button"
									onClick={() => onChange({ priority: option })}
									className="inline-flex min-w-0 items-center justify-center gap-1.5 border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
									style={{
										borderRadius: `${Math.max(controlRadius, 0)}px`,
										borderColor: isActive ? meta.borderColor : 'var(--color-border)',
										background: isActive
											? meta.background
											: 'color-mix(in srgb, var(--color-surface-strong) 95%, white)',
										color: isActive ? meta.color : 'var(--color-text-secondary)',
									}}
								>
									<span
										className="h-1.5 w-1.5 rounded-full"
										style={{ background: meta.color }}
									/>
									{meta.label}
								</button>
							);
						})}
					</div>
				</div>

				<KanbanChecklistEditor card={card} controlRadius={controlRadius} onChange={onChange} />
			</div>
		</div>
	);
}
