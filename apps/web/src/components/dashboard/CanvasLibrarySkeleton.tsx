export function CanvasLibrarySkeleton() {
	return (
		<div className="space-y-5">
			<div className="app-panel app-panel-strong h-[4.75rem] animate-pulse rounded-[18px] bg-white/70" />
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items
						key={index}
						className="app-panel app-panel-strong h-[22rem] animate-pulse rounded-[14px] bg-white/70"
					/>
				))}
			</div>
		</div>
	);
}
