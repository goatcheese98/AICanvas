import { ChevronRightIcon } from './DashboardProfileIcons';

interface MenuActionProps {
	description: string;
	label: string;
	onClick: () => void;
}

export function MenuAction({ description, label, onClick }: MenuActionProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full items-start justify-between gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[var(--color-accent-bg)]/65"
		>
			<div>
				<div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
				<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
					{description}
				</div>
			</div>
			<div className="mt-0.5 shrink-0">
				<ChevronRightIcon />
			</div>
		</button>
	);
}
