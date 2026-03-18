import {
	NOTE_PANEL,
	NOTE_SEGMENTED_ACTIVE,
	NOTE_SEGMENTED_BUTTON,
	NOTE_SEGMENTED_IDLE,
	NOTE_SEGMENTED_SHELL,
} from './markdown-note-helpers';

export interface MarkdownImagePanelProps {
	imageCount: number;
	onActiveUtilityPanelChange: (panel: 'style') => void;
	onRequestImagePicker: () => void;
}

export function MarkdownImagePanel({
	imageCount,
	onActiveUtilityPanelChange,
	onRequestImagePicker,
}: MarkdownImagePanelProps) {
	return (
		<div className={`${NOTE_PANEL} w-[18rem]`}>
			<div className={`mb-3 ${NOTE_SEGMENTED_SHELL}`}>
				<button
					type="button"
					onClick={() => onActiveUtilityPanelChange('style')}
					className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_IDLE}`}
				>
					Style
				</button>
				<button type="button" className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_ACTIVE}`}>
					Image
				</button>
			</div>
			<div className="mt-3 space-y-3">
				<button
					type="button"
					onClick={onRequestImagePicker}
					className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<path d="M7 10l5-5 5 5" />
						<path d="M12 15V5" />
					</svg>
					Upload image
				</button>
				<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-2.5 py-2.5 text-[11px] text-stone-500">
					<div>
						{imageCount} image{imageCount === 1 ? '' : 's'} attached to this note.
					</div>
					<div className="mt-1">
						You can also paste images directly while editing in raw or hybrid mode.
					</div>
				</div>
			</div>
		</div>
	);
}
