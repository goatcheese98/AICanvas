import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import { KANBAN_ACCENT_BORDER, KANBAN_ACCENT_SURFACE, KANBAN_ACCENT_TEXT } from './kanban-theme';

interface KanbanChecklistEditorProps {
	card: KanbanCardType;
	controlRadius: number;
	onChange: (updates: Partial<KanbanCardType>) => void;
}

export function KanbanChecklistEditor({
	card,
	controlRadius,
	onChange,
}: KanbanChecklistEditorProps) {
	const checklist = card.checklist ?? [];

	const updateChecklist = (
		updater: (
			current: NonNullable<KanbanCardType['checklist']>,
		) => NonNullable<KanbanCardType['checklist']>,
	) => {
		onChange({ checklist: updater(card.checklist ?? []) });
	};

	return (
		<div>
			<div className="mb-2 flex items-center justify-between gap-2">
				<div
					className="text-[10px] font-semibold uppercase tracking-[0.16em]"
					style={{ color: 'var(--color-text-tertiary)' }}
				>
					Checklist
				</div>
				<button
					type="button"
					onClick={() => updateChecklist((current) => [...current, { text: '', done: false }])}
					className="inline-flex items-center border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
					style={{
						borderRadius: `${Math.max(controlRadius, 0)}px`,
						borderColor: KANBAN_ACCENT_BORDER,
						background: KANBAN_ACCENT_SURFACE,
						color: KANBAN_ACCENT_TEXT,
					}}
				>
					Add item
				</button>
			</div>

			<div className="space-y-2">
				{checklist.length
					? checklist.map((item, index) => (
							<div
								key={`${card.id}-check-${index}`}
								className="flex items-center gap-2 border px-2.5 py-2"
								style={{
									borderRadius: `${Math.max(controlRadius, 0)}px`,
									borderColor:
										'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
									background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
								}}
							>
								<input
									type="checkbox"
									checked={item.done}
									onChange={(event) =>
										updateChecklist((current) =>
											current.map((candidate, candidateIndex) =>
												candidateIndex === index
													? { ...candidate, done: event.target.checked }
													: candidate,
											),
										)
									}
									className="h-4 w-4 rounded border-[var(--color-border)]"
								/>
								<input
									value={item.text}
									onChange={(event) =>
										updateChecklist((current) =>
											current.map((candidate, candidateIndex) =>
												candidateIndex === index
													? { ...candidate, text: event.target.value }
													: candidate,
											),
										)
									}
									maxLength={200}
									className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none"
									style={{
										color: 'var(--color-text-primary)',
										fontFamily: 'inherit',
									}}
									placeholder="Checklist item"
								/>
								<button
									type="button"
									onClick={() =>
										updateChecklist((current) =>
											current.filter((_, candidateIndex) => candidateIndex !== index),
										)
									}
									className="inline-flex h-8 w-8 items-center justify-center border"
									style={{
										borderRadius: `${Math.max(controlRadius, 0)}px`,
										borderColor:
											'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
										background: 'var(--color-surface-strong)',
										color: 'var(--color-text-tertiary)',
									}}
									aria-label="Delete checklist item"
								>
									×
								</button>
							</div>
						))
					: null}
				{checklist.length === 0 ? (
					<div className="px-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
						Add the first item when this card needs a clear sequence.
					</div>
				) : null}
			</div>
		</div>
	);
}
