interface CanvasLibraryEmptyProps {
	onCreateClick: () => void;
}

export function CanvasLibraryEmpty({ onCreateClick }: CanvasLibraryEmptyProps) {
	return (
		<div className="app-panel app-panel-strong rounded-[16px] px-8 py-14 text-center">
			<div className="mx-auto max-w-xl">
				<h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">No canvases yet</h2>
				<p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
					Create your first canvas to get started.
				</p>
				<button
					type="button"
					onClick={onCreateClick}
					className="app-button app-button-primary mt-6"
				>
					Create Canvas
				</button>
			</div>
		</div>
	);
}
