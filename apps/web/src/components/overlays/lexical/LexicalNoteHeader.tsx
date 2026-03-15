import {
	MAX_NEWLEX_TITLE_LENGTH,
	MIN_EXPANDED_EDITOR_WIDTH,
	MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH,
} from './lexical-note-helpers';

interface LexicalNoteHeaderProps {
	title: string;
	titleNotice: boolean;
	isSelected: boolean;
	isEditing: boolean;
	commentsPanelOpen: boolean;
	commentCount: number;
	elementWidth: number;
	onTitleChange: (value: string) => void;
	onCommitTitle: () => void;
	onToggleCommentsPanel: () => void;
	onToggleEditing: () => void;
	onExpandForToolbar: () => void;
	onShowTitleLimitNotice: () => void;
}

export function LexicalNoteHeader({
	title,
	titleNotice,
	isSelected,
	isEditing,
	commentsPanelOpen,
	commentCount,
	elementWidth,
	onTitleChange,
	onCommitTitle,
	onToggleCommentsPanel,
	onToggleEditing,
	onExpandForToolbar,
	onShowTitleLimitNotice,
}: LexicalNoteHeaderProps) {
	const needsToolbarExpansion =
		isEditing &&
		isSelected &&
		elementWidth <
			(commentsPanelOpen
				? MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH
				: MIN_EXPANDED_EDITOR_WIDTH);
	const shouldShowCommentsToggle = commentsPanelOpen || commentCount > 0;

	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-200/90 bg-transparent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
			<div className="min-w-0">
				{isSelected ? (
					<div className="min-w-0">
						<input
							type="text"
							value={title}
							maxLength={MAX_NEWLEX_TITLE_LENGTH}
							onChange={(event) => onTitleChange(event.target.value)}
							onPaste={(event) => {
								const pasted = event.clipboardData.getData('text');
								if (event.currentTarget.value.length + pasted.length > MAX_NEWLEX_TITLE_LENGTH) {
									onShowTitleLimitNotice();
								}
							}}
							onBlur={onCommitTitle}
							className="w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-600 outline-none transition-colors focus:border-[#d7dafd] focus:bg-white/70"
							aria-label="Rich text title"
						/>
						{titleNotice ? (
							<div className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-amber-600">
								Title is limited to 32 characters.
							</div>
						) : null}
					</div>
				) : (
					<span className="truncate px-1 text-stone-600">{title}</span>
				)}
			</div>
			<div className="flex items-center gap-2">
				{needsToolbarExpansion ? (
					<button
						type="button"
						className="rounded-[8px] border border-[#d7dafd] bg-[#eef0ff] px-2.5 py-1 text-[10px] text-[#4d55cc] transition hover:bg-[#e3e7ff]"
						onClick={onExpandForToolbar}
					>
						Expand
					</button>
				) : null}
				{shouldShowCommentsToggle ? (
					<button
						type="button"
						className={`rounded-[8px] border px-2.5 py-1 text-[10px] transition-colors ${
							commentsPanelOpen
								? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
								: 'border-stone-200 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]'
						}`}
						onClick={onToggleCommentsPanel}
					>
						{commentCount} comments
					</button>
				) : null}
				{isSelected ? (
					<button
						type="button"
						className={`rounded-[8px] border px-2.5 py-1 text-[10px] transition-colors ${
							isEditing
								? 'border-stone-900 bg-stone-900 text-white'
								: 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
						}`}
						onClick={onToggleEditing}
					>
						{isEditing ? 'Exit' : 'Edit'}
					</button>
				) : null}
			</div>
		</div>
	);
}
