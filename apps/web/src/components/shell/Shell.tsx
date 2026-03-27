import type { ReactNode } from 'react';
import type { RightPanelMode, ShellState } from './useShellState';
import { cn } from './utils';

interface ShellProps {
	children: ReactNode;
	shellState: ShellState;
	sidebarContent: ReactNode;
	rightPanelContent?: Record<Exclude<RightPanelMode, 'none'>, ReactNode>;
	className?: string;
	onOpenRightPanel?: (mode: Exclude<RightPanelMode, 'none'>) => void;
}

export function Shell({
	children,
	shellState,
	sidebarContent,
	rightPanelContent,
	className,
	onOpenRightPanel,
}: ShellProps) {
	const { isSidebarExpanded, sidebarWidth, rightPanelMode, rightPanelWidth } = shellState;
	const isRightPanelOpen = rightPanelMode !== 'none';
	const showEdgeTriggers = !isSidebarExpanded && !isRightPanelOpen;

	return (
		<div className={cn('flex h-screen w-screen overflow-hidden bg-stone-50', className)}>
			{/* Left Sidebar */}
			<aside
				className="flex-shrink-0 border-r border-stone-200 bg-white transition-all duration-200 ease-in-out"
				style={{ width: sidebarWidth }}
			>
				{sidebarContent}
			</aside>

			{/* Main Content Area */}
			<main className="relative flex-1 overflow-hidden transition-all duration-200 ease-in-out">
				{children}

				{/* Right Edge Triggers */}
				{showEdgeTriggers && onOpenRightPanel && (
					<RightEdgeTriggers onOpenRightPanel={onOpenRightPanel} />
				)}
			</main>

			{/* Right Panel */}
			{isRightPanelOpen && rightPanelContent && (
				<aside
					className="flex-shrink-0 border-l border-stone-200 bg-white transition-all duration-200 ease-in-out"
					style={{ width: rightPanelWidth }}
				>
					{rightPanelContent[rightPanelMode as Exclude<RightPanelMode, 'none'>]}
				</aside>
			)}
		</div>
	);
}

// Separate component for edge triggers
interface RightEdgeTriggersProps {
	onOpenRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;
}

function RightEdgeTriggers({ onOpenRightPanel }: RightEdgeTriggersProps) {
	return (
		<div className="absolute right-0 top-0 z-30 h-full w-14">
			{/* Full-height hover target */}
			<div className="group relative h-full w-full">
				{/* Visual indicator line (always visible, subtle) */}
				<div className="absolute right-0 top-0 h-full w-[2px] bg-gradient-to-b from-transparent via-stone-200 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

				{/* Buttons container - appears on hover */}
				<div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 opacity-0 transition-all duration-200 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
					{/* AI Button */}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onOpenRightPanel('ai');
						}}
						className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-all hover:scale-105 hover:border-[#4d55cc] hover:text-[#4d55cc]"
						title="AI Assistant (⌘B)"
					>
						<BotIcon />
					</button>

					{/* Details Button */}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onOpenRightPanel('details');
						}}
						className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-all hover:scale-105 hover:border-[#4d55cc] hover:text-[#4d55cc]"
						title="Details (⌘I)"
					>
						<InfoIcon />
					</button>
				</div>
			</div>
		</div>
	);
}

// Inline SVG Icons
function BotIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>AI</title>
			<path d="M12 8V4H8" />
			<rect width="16" height="12" x="4" y="8" rx="2" />
			<path d="M2 14h2" />
			<path d="M20 14h2" />
			<path d="M15 13v2" />
			<path d="M9 13v2" />
		</svg>
	);
}

function InfoIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Details</title>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 16v-4" />
			<path d="M12 8h.01" />
		</svg>
	);
}
