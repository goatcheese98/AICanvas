interface CanvasLibraryErrorProps {
	error: Error | null;
}

export function CanvasLibraryError({ error }: CanvasLibraryErrorProps) {
	return (
		<div className="app-panel app-panel-strong rounded-[28px] border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-6 py-8">
			<div className="app-kicker">Library Error</div>
			<div className="mt-4 text-2xl font-semibold text-[var(--color-danger-text)]">
				Unable to load your canvases.
			</div>
			<p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-danger-text)]">
				{error?.message ?? 'Failed to load canvases.'}
			</p>
		</div>
	);
}
