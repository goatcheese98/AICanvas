import { useUser } from '@clerk/clerk-react';
import { CanvasLibrary } from './CanvasLibrary';
import { DashboardProfileMenu } from './DashboardProfileMenu';

export function Dashboard() {
	const { user } = useUser();
	const displayName = user?.fullName || user?.firstName || user?.username || 'Workspace';
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

							<DashboardProfileMenu
								displayName={displayName}
								email={email}
								imageUrl={user?.imageUrl}
								initials={initials}
							/>
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
