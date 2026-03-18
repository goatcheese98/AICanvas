import type { Canvas } from '@ai-canvas/shared/types';

interface DeleteCanvasDialogProps {
	canvas: Canvas;
	error: string | null;
	isDeleting: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

export function DeleteCanvasDialog({
	canvas,
	error,
	isDeleting,
	onClose,
	onConfirm,
}: DeleteCanvasDialogProps) {
	return (
		<div className="app-dialog-backdrop fixed inset-0 z-40 flex items-center justify-center p-4">
			<div className="app-panel app-panel-strong w-full max-w-md overflow-hidden rounded-[18px]">
				<div className="px-6 py-6">
					<h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Delete Canvas</h2>
					<p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
						Are you sure you want to delete{' '}
						<span className="font-semibold text-[var(--color-text-primary)]">{canvas.title}</span>?
						This cannot be undone.
					</p>
					{error ? (
						<div className="mt-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
							{error}
						</div>
					) : null}
				</div>
				<div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
					<button
						type="button"
						onClick={onClose}
						disabled={isDeleting}
						className="app-button app-button-secondary"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={isDeleting}
						className="app-button app-button-danger"
					>
						{isDeleting ? 'Deleting…' : 'Delete Canvas'}
					</button>
				</div>
			</div>
		</div>
	);
}
