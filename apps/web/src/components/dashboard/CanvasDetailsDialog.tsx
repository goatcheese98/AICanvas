import type { CanvasFormState } from './canvas-library-types';

interface CanvasDetailsDialogProps {
	title: string;
	submitLabel: string;
	value: CanvasFormState;
	error: string | null;
	isSubmitting: boolean;
	onChange: (next: CanvasFormState) => void;
	onClose: () => void;
	onSubmit: () => void;
}

export function CanvasDetailsDialog({
	title,
	submitLabel,
	value,
	error,
	isSubmitting,
	onChange,
	onClose,
	onSubmit,
}: CanvasDetailsDialogProps) {
	return (
		<div className="app-dialog-backdrop fixed inset-0 z-40 flex items-center justify-center p-4">
			<div className="app-panel app-panel-strong w-full max-w-xl overflow-hidden rounded-[18px]">
				<div className="border-b border-[var(--color-border)] px-6 py-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="app-kicker">Canvas Details</p>
							<h2 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">
								{title}
							</h2>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="app-button app-button-secondary px-4 py-2.5"
						>
							Close
						</button>
					</div>
				</div>

				<div className="space-y-4 px-6 py-6">
					<div>
						<label
							htmlFor="canvas-name"
							className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]"
						>
							Canvas Name
						</label>
						<input
							id="canvas-name"
							value={value.title}
							onChange={(event) => onChange({ ...value, title: event.target.value })}
							className="app-field"
							placeholder="Q2 experience strategy"
						/>
					</div>

					<div>
						<label
							htmlFor="canvas-description"
							className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]"
						>
							Description
						</label>
						<textarea
							id="canvas-description"
							value={value.description}
							onChange={(event) => onChange({ ...value, description: event.target.value })}
							className="app-field-multiline"
							placeholder="What this canvas is for"
						/>
					</div>

					<label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[var(--color-border)] bg-white/72 px-4 py-4">
						<input
							type="checkbox"
							checked={value.isPublic}
							onChange={(event) => onChange({ ...value, isPublic: event.target.checked })}
							className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent-text)]"
						/>
						<div className="text-sm text-[var(--color-text-primary)]">Make canvas public</div>
					</label>

					{error ? (
						<div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
							{error}
						</div>
					) : null}
				</div>

				<div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center justify-end gap-3">
						<button type="button" onClick={onClose} className="app-button app-button-secondary">
							Cancel
						</button>
						<button
							type="button"
							onClick={onSubmit}
							disabled={isSubmitting}
							className="app-button app-button-primary"
						>
							{submitLabel}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
