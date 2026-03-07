import { useUser } from '@clerk/clerk-react';
import { CanvasLibrary } from './CanvasLibrary';

export function Dashboard() {
	const { user } = useUser();

	return (
		<div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(245,239,224,0.92),_rgba(255,255,255,1)_44%,_rgba(232,244,255,0.86)_100%)]">
			<header className="border-b border-stone-200 bg-white/75 px-6 py-5 backdrop-blur">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
								Canvas Workspace
							</p>
							<h1 className="text-2xl font-semibold text-stone-900">My Canvases</h1>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button
							type="button"
							className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
						>
							Standalone Build
						</button>
						<div className="flex items-center gap-2">
							{user?.imageUrl && (
								<img
									src={user.imageUrl}
									alt=""
									className="h-8 w-8 rounded-full"
								/>
							)}
							<span className="text-sm text-stone-600">
								{user?.fullName}
							</span>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl p-6">
				<section className="mb-6 max-w-3xl">
					<p className="text-sm leading-relaxed text-stone-600">
						Browse, create, favorite, and remove saved canvases from the standalone app. This dashboard is now wired against the Hono API with authenticated TanStack Query calls.
					</p>
				</section>
				<CanvasLibrary />
			</main>
		</div>
	);
}
