import { ChevronDownIcon } from './DashboardProfileIcons';

interface DashboardProfileTriggerProps {
	displayName: string;
	email: string;
	imageUrl: string | null | undefined;
	initials: string;
	isMenuOpen: boolean;
	onClick: () => void;
}

export function DashboardProfileTrigger({
	displayName,
	email,
	imageUrl,
	initials,
	isMenuOpen,
	onClick,
}: DashboardProfileTriggerProps) {
	return (
		<button
			type="button"
			aria-expanded={isMenuOpen}
			aria-haspopup="dialog"
			aria-label="Open profile menu"
			onClick={onClick}
			className="flex min-w-[16rem] max-w-[18rem] items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-white/82 px-2.5 py-2 pr-3 shadow-sm transition hover:border-[var(--color-accent-border)] hover:bg-white"
		>
			{imageUrl ? (
				<img src={imageUrl} alt="" className="h-10 w-10 rounded-[10px] object-cover" />
			) : (
				<div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-accent-bg)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]">
					{initials}
				</div>
			)}

			<div className="min-w-0 flex-1 text-left">
				<div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
					{displayName}
				</div>
				<div className="truncate text-xs text-[var(--color-text-secondary)]">{email}</div>
			</div>

			<div className="shrink-0">
				<ChevronDownIcon />
			</div>
		</button>
	);
}
