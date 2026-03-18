import type { Canvas } from '@ai-canvas/shared/types';
import { CanvasPreviewThumbnail } from './CanvasPreviewThumbnail';
import { formatCanvasUpdatedAt } from './dashboard-utils';

interface CanvasCardProps {
	canvas: Canvas;
	onOpen: () => void;
	onRename: () => void;
	onDelete: () => void;
	onToggleFavorite: () => void;
}

export function CanvasCard({
	canvas,
	onOpen,
	onRename,
	onDelete,
	onToggleFavorite,
}: CanvasCardProps) {
	return (
		<article className="app-panel app-panel-strong app-card-hover group flex h-full flex-col overflow-hidden rounded-[14px]">
			{/* biome-ignore lint/a11y/useSemanticElements: original implementation uses div with role button */}
			<div
				role="button"
				tabIndex={0}
				onClick={onOpen}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onOpen();
					}
				}}
				className="flex flex-1 cursor-pointer flex-col text-left outline-none"
			>
				<div className="relative h-40 overflow-hidden border-b border-[var(--color-border)]">
					<CanvasPreviewThumbnail
						canvasId={canvas.id}
						title={canvas.title}
						thumbnailUrl={canvas.thumbnailUrl}
					/>

					<div className="absolute left-3 top-3 flex flex-wrap gap-2">
						<span
							className={
								canvas.isPublic ? 'app-badge app-badge-accent' : 'app-badge app-badge-muted'
							}
						>
							{canvas.isPublic ? 'Public' : 'Private'}
						</span>
						{canvas.isFavorite ? <span className="app-badge app-badge-muted">Favorite</span> : null}
					</div>

					<div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(250,251,252,0)_0%,rgba(250,251,252,0.96)_52%,rgba(250,251,252,1)_100%)] px-4 pb-3 pt-10">
						<div className="flex items-end justify-between gap-3">
							<div className="min-w-0">
								<div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
									Updated {formatCanvasUpdatedAt(canvas.updatedAt)}
								</div>
								<h3 className="mt-1.5 truncate text-lg font-semibold text-[var(--color-text-primary)]">
									{canvas.title}
								</h3>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-1 flex-col px-4 py-4">
					<p className="min-h-10 text-[13px] leading-6 text-[var(--color-text-secondary)]">
						{canvas.description || 'No description yet.'}
					</p>
				</div>
			</div>

			<div className="border-t border-[var(--color-border)] px-4 py-3">
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onRename();
						}}
						className="app-button app-button-secondary px-3.5 py-2.5"
					>
						Rename
					</button>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onToggleFavorite();
						}}
						className="app-button app-button-secondary px-3.5 py-2.5"
					>
						{canvas.isFavorite ? 'Unfavorite' : 'Favorite'}
					</button>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							onDelete();
						}}
						className="app-button app-button-danger px-3.5 py-2.5"
					>
						Delete
					</button>
				</div>
			</div>
		</article>
	);
}
