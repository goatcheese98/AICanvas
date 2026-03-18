interface ToggleRowProps {
	description: string;
	isEnabled: boolean;
	label: string;
	onToggle: () => void;
}

export function ToggleRow({ description, isEnabled, label, onToggle }: ToggleRowProps) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className="flex w-full items-start justify-between gap-4 rounded-[16px] border border-[var(--color-border)] bg-white/80 px-4 py-4 text-left transition hover:border-[var(--color-accent-border)] hover:bg-white"
		>
			<div>
				<div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
				<div className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
					{description}
				</div>
			</div>
			<div
				aria-hidden="true"
				className={`mt-1 inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
					isEnabled
						? 'bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
						: 'bg-slate-100 text-slate-500'
				}`}
			>
				{isEnabled ? 'On' : 'Off'}
			</div>
		</button>
	);
}
