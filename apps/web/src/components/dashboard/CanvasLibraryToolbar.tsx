import { startTransition } from 'react';
import type { DashboardSortOption } from './dashboard-utils';

interface CanvasLibraryToolbarProps {
	searchTerm: string;
	sortBy: DashboardSortOption;
	isCreating: boolean;
	onSearchChange: (value: string) => void;
	onSortChange: (sort: DashboardSortOption) => void;
	onCreateClick: () => void;
}

const SORT_OPTIONS: Array<[DashboardSortOption, string]> = [
	['recent', 'Recent'],
	['alphabetical', 'A-Z'],
	['favorites', 'Favorites'],
];

export function CanvasLibraryToolbar({
	searchTerm,
	sortBy,
	isCreating,
	onSearchChange,
	onSortChange,
	onCreateClick,
}: CanvasLibraryToolbarProps) {
	const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		startTransition(() => onSearchChange(value));
	};

	return (
		<div className="app-panel app-panel-strong rounded-[18px] px-4 py-4 sm:px-5">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<label className="relative min-w-0 flex-1">
					<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
						<svg
							aria-hidden="true"
							viewBox="0 0 20 20"
							fill="none"
							className="h-4 w-4"
							stroke="currentColor"
							strokeWidth="1.7"
						>
							<circle cx="9" cy="9" r="5.25" />
							<path d="M13 13l3.5 3.5" strokeLinecap="round" />
						</svg>
					</span>
					<input
						value={searchTerm}
						onChange={handleSearchChange}
						placeholder="Search canvases"
						className="app-input app-search-input"
					/>
				</label>

				<div className="flex flex-wrap items-center gap-2">
					{SORT_OPTIONS.map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => onSortChange(value)}
							className={`app-toolbar-chip ${sortBy === value ? 'app-toolbar-chip-active' : ''}`}
						>
							{label}
						</button>
					))}
				</div>

				<div className="lg:ml-auto">
					<button
						type="button"
						onClick={onCreateClick}
						disabled={isCreating}
						className="app-button app-button-primary w-full lg:w-auto"
					>
						New Canvas
					</button>
				</div>
			</div>
		</div>
	);
}
