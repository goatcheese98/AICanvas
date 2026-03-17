import { KANBAN_BUTTON, getKanbanPanelStyle } from './kanban-ui';

interface KanbanDeleteColumnDialogProps {
	columnTitle: string;
	cardCount: number;
	onCancel: () => void;
	onConfirm: () => void;
}

export function KanbanDeleteColumnDialog({
	columnTitle,
	cardCount,
	onCancel,
	onConfirm,
}: KanbanDeleteColumnDialogProps) {
	return (
		<div
			className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(15,23,42,0.24)] p-4"
			onMouseDown={(event) => {
				if (event.currentTarget === event.target) {
					onCancel();
				}
			}}
		>
			<div
				className="w-full max-w-[25rem] rounded-[22px] border p-5 shadow-[var(--shadow-float)]"
				style={{
					borderColor: 'var(--color-border)',
					background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
				}}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div
					className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
					style={{ color: 'var(--color-danger-text)' }}
				>
					Remove column
				</div>
				<div className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
					Delete &quot;{columnTitle}&quot;?
				</div>
				<div className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
					This removes the column and its {cardCount} card
					{cardCount === 1 ? '' : 's'}.
				</div>
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className={KANBAN_BUTTON}
						style={getKanbanPanelStyle()}
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className={KANBAN_BUTTON}
						style={{
							borderColor: 'var(--color-danger-border)',
							background: 'var(--color-danger-bg)',
							color: 'var(--color-danger-text)',
						}}
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}
