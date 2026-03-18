import { CloseIcon } from './DashboardProfileIcons';

interface UserInfoProps {
	displayName: string;
	email: string;
	imageUrl: string | null | undefined;
	initials: string;
	onClose: () => void;
}

export function UserInfo({ displayName, email, imageUrl, initials, onClose }: UserInfoProps) {
	return (
		<div className="border-b border-[var(--color-border)] px-3 pb-4 pt-3">
			<div className="flex items-start justify-between gap-3 rounded-[14px] bg-[var(--color-accent-bg)]/60 px-4 py-4">
				<div className="flex min-w-0 items-center gap-3">
					{imageUrl ? (
						<img src={imageUrl} alt="" className="h-12 w-12 rounded-[12px] object-cover" />
					) : (
						<div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]">
							{initials}
						</div>
					)}
					<div className="min-w-0">
						<div className="truncate text-base font-semibold text-[var(--color-text-primary)]">
							{displayName}
						</div>
						<div className="truncate text-sm text-[var(--color-text-secondary)]">{email}</div>
					</div>
				</div>

				<button
					type="button"
					aria-label="Close profile menu"
					onClick={onClose}
					className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--color-text-secondary)] transition hover:bg-white/80 hover:text-[var(--color-text-primary)]"
				>
					<CloseIcon />
				</button>
			</div>
		</div>
	);
}
