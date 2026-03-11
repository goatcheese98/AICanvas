import { useUser } from '@clerk/clerk-react';
import { CanvasLibrary } from './CanvasLibrary';

export function Dashboard() {
	const { user } = useUser();
	const displayName = user?.firstName || user?.fullName || user?.username || 'Workspace';
	const email = user?.primaryEmailAddress?.emailAddress ?? 'Signed in';
	const initials =
		user?.fullName
			?.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') ||
		user?.firstName?.slice(0, 1).toUpperCase() ||
		'AI';

	return (
		<div className="app-shell min-h-full overflow-hidden">
			<div className="app-grid pointer-events-none absolute inset-0 opacity-60" />

			<div className="relative mx-auto flex min-h-full max-w-7xl flex-col px-4 pb-10 pt-3 sm:px-6 lg:px-8">
				<header className="sticky top-3 z-20">
					<div className="app-panel rounded-[16px] px-5 py-3.5 sm:px-6">
						<div className="flex items-center justify-between gap-4">
							<div className="min-w-0">
								<p className="app-kicker">Canvas Workspace</p>
								<h1 className="app-display mt-1 text-[1.3rem] leading-none text-[var(--color-text-primary)] sm:text-[1.45rem]">
									My Canvases
								</h1>
							</div>

							<div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-white/72 px-2.5 py-2 pr-4">
								{user?.imageUrl ? (
									<img src={user.imageUrl} alt="" className="h-10 w-10 rounded-[10px] object-cover" />
								) : (
									<div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-accent-bg)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]">
										{initials}
									</div>
								)}
								<div className="min-w-0">
									<div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
										{displayName}
									</div>
									<div className="truncate text-xs text-[var(--color-text-secondary)]">{email}</div>
								</div>
							</div>
						</div>
					</div>
				</header>

				<main className="pt-5">
					<section>
						<CanvasLibrary />
					</section>
				</main>
			</div>
		</div>
	);
}
