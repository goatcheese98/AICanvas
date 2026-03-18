import type { CSSProperties } from 'react';
import { KANBAN_ACCENT_BORDER, KANBAN_ACCENT_SURFACE, KANBAN_ACCENT_TEXT } from './kanban-theme';
import { KANBAN_ICON_BUTTON, getKanbanPanelStyle } from './kanban-ui';

interface KanbanBoardHeaderProps {
	boardTitleDraft: string;
	boardColumnCount: number;
	boardCardCount: number;
	lastUpdated: string;
	searchQuery: string;
	searchFocused: boolean;
	canUndo: boolean;
	canRedo: boolean;
	showSettings: boolean;
	headerBackground: string;
	borderTone: string;
	onBoardTitleDraftChange: (value: string) => void;
	onCommitBoardTitle: () => void;
	onSearchQueryChange: (value: string) => void;
	onSearchFocusChange: (focused: boolean) => void;
	onUndo: () => void;
	onRedo: () => void;
	onToggleSettings: () => void;
}

function HistoryIcon({ direction }: { direction: 'undo' | 'redo' }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden="true"
		>
			{direction === 'undo' ? (
				<>
					<path d="M7 4 3.5 7.5 7 11" />
					<path d="M4 7.5h6a5 5 0 1 1 0 10H7" />
				</>
			) : (
				<>
					<path d="M13 4 16.5 7.5 13 11" />
					<path d="M16 7.5h-6a5 5 0 1 0 0 10h3" />
				</>
			)}
		</svg>
	);
}

function SettingsIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden="true"
		>
			<path d="M4 5.5h12" />
			<path d="M4 10h12" />
			<path d="M4 14.5h12" />
			<circle cx="7" cy="5.5" r="1.5" />
			<circle cx="13" cy="10" r="1.5" />
			<circle cx="9" cy="14.5" r="1.5" />
		</svg>
	);
}

function SearchIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4 shrink-0"
			aria-hidden="true"
		>
			<circle cx="8.5" cy="8.5" r="5" />
			<path d="M14 14l3 3" />
		</svg>
	);
}

export function KanbanBoardHeader({
	boardTitleDraft,
	boardColumnCount,
	boardCardCount,
	lastUpdated,
	searchQuery,
	searchFocused,
	canUndo,
	canRedo,
	showSettings,
	headerBackground,
	borderTone,
	onBoardTitleDraftChange,
	onCommitBoardTitle,
	onSearchQueryChange,
	onSearchFocusChange,
	onUndo,
	onRedo,
	onToggleSettings,
}: KanbanBoardHeaderProps) {
	const searchStyle: CSSProperties = {
		borderColor: searchFocused || searchQuery ? KANBAN_ACCENT_BORDER : 'var(--color-border)',
		backgroundColor:
			searchFocused || searchQuery ? KANBAN_ACCENT_SURFACE : 'var(--color-surface-strong)',
		backgroundImage: 'var(--kanban-sketch-control-texture)',
		color: searchQuery ? KANBAN_ACCENT_TEXT : 'var(--color-text-secondary)',
		height: '2rem',
		width: searchFocused || searchQuery ? '9rem' : '2rem',
		boxShadow: 'var(--kanban-sketch-control-shadow)',
		transitionDuration: 'var(--kanban-motion-duration-fast)',
	};

	return (
		<div
			className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-3"
			style={{
				borderColor: borderTone,
				background: headerBackground,
			}}
		>
			<div className="min-w-0">
				<input
					value={boardTitleDraft}
					onChange={(event) => onBoardTitleDraftChange(event.target.value)}
					onBlur={onCommitBoardTitle}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							event.currentTarget.blur();
						}
					}}
					maxLength={120}
					className="min-w-0 w-full border-0 bg-transparent text-[16px] font-semibold outline-none"
					style={{ color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
				/>
			</div>

			<div className="flex shrink-0 flex-nowrap items-center gap-1.5 pl-2">
				{lastUpdated && (
					<span
						className="inline-flex shrink-0 items-center text-[10px] font-medium tracking-[0.08em]"
						style={{ color: 'var(--color-text-tertiary)' }}
						title={`Last updated: ${new Date().toLocaleString()}`}
					>
						{lastUpdated}
					</span>
				)}

				<span
					className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
					style={{
						borderColor: KANBAN_ACCENT_BORDER,
						backgroundColor: KANBAN_ACCENT_SURFACE,
						backgroundImage: 'var(--kanban-sketch-control-texture)',
						color: KANBAN_ACCENT_TEXT,
						boxShadow: 'var(--kanban-sketch-control-shadow)',
					}}
				>
					{boardColumnCount} columns / {boardCardCount} cards
				</span>

				<div
					className={`flex shrink-0 items-center rounded-[10px] border transition-[width,padding,gap,border-color,background-color,color] ${
						searchFocused || searchQuery ? 'justify-start gap-2 px-2.5' : 'justify-center px-0'
					}`}
					style={searchStyle}
				>
					<SearchIcon />
					<input
						value={searchQuery}
						onChange={(event) => onSearchQueryChange(event.target.value)}
						onFocus={() => onSearchFocusChange(true)}
						onBlur={() => onSearchFocusChange(false)}
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								onSearchQueryChange('');
								event.currentTarget.blur();
							}
						}}
						placeholder="Search cards…"
						className="min-w-0 flex-1 border-0 bg-transparent text-[11px] outline-none"
						style={{
							color: 'var(--color-text-primary)',
							fontFamily: 'inherit',
							display: searchFocused || searchQuery ? undefined : 'none',
						}}
					/>
				</div>

				<button
					type="button"
					onClick={onUndo}
					disabled={!canUndo}
					className={KANBAN_ICON_BUTTON}
					style={getKanbanPanelStyle()}
					title="Undo"
				>
					<HistoryIcon direction="undo" />
				</button>
				<button
					type="button"
					onClick={onRedo}
					disabled={!canRedo}
					className={KANBAN_ICON_BUTTON}
					style={getKanbanPanelStyle()}
					title="Redo"
				>
					<HistoryIcon direction="redo" />
				</button>
				<button
					type="button"
					onClick={onToggleSettings}
					className={KANBAN_ICON_BUTTON}
					style={getKanbanPanelStyle(showSettings)}
					title="Board appearance"
				>
					<SettingsIcon />
				</button>
			</div>
		</div>
	);
}
