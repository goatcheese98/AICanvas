import { BackIcon, CloseIcon } from './DashboardProfileIcons';

interface PanelHeaderProps {
	description: string;
	onBack: () => void;
	onClose: () => void;
	title: string;
}

export function PanelHeader({ description, onBack, onClose, title }: PanelHeaderProps) {
	return (
		<div className="border-b border-[var(--color-border)] px-3 pb-4 pt-3">
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					aria-label="Go back"
					onClick={onBack}
					className="inline-flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-accent-bg)]/65 hover:text-[var(--color-text-primary)]"
				>
					<BackIcon />
					Back
				</button>
				<button
					type="button"
					aria-label="Close profile menu"
					onClick={onClose}
					className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-accent-bg)]/65 hover:text-[var(--color-text-primary)]"
				>
					<CloseIcon />
				</button>
			</div>

			<div className="px-2 pt-3">
				<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
					Profile Settings
				</div>
				<h2 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
				<p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
			</div>
		</div>
	);
}
