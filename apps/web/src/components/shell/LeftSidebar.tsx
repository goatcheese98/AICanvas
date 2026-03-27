import { useUser } from '@clerk/clerk-react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import type { ProjectResource, ResourceType } from './types';
import { cn } from './utils';

interface LeftSidebarProps {
	isExpanded: boolean;
	onToggleExpand: () => void;
	projectName: string;
	resources: ProjectResource[];
	activeResourceId?: string;
	onResourceClick: (resource: ProjectResource) => void;
	onNewClick: () => void;
	onOpenAI?: () => void;
	onOpenDetails?: () => void;
	isAIOpen?: boolean;
	isDetailsOpen?: boolean;
	collaboration: {
		isCollaborating: boolean;
		collaborators: { id: string; name: string; avatarUrl?: string }[];
		onShareClick: () => void;
		isShareOpen?: boolean;
	};
}

const RESOURCE_ICONS: Record<ResourceType, () => ReactElement> = {
	canvas: LayoutIcon,
	board: LayoutIcon,
	prototype: LayoutIcon,
};

export function LeftSidebar({
	isExpanded,
	onToggleExpand,
	projectName,
	resources,
	activeResourceId,
	onResourceClick,
	onNewClick,
	onOpenAI,
	onOpenDetails,
	isAIOpen,
	isDetailsOpen,
	collaboration,
}: LeftSidebarProps) {
	const { isShareOpen } = collaboration;
	const { user } = useUser();

	const initials = useMemo(() => {
		const name = user?.fullName || user?.firstName || user?.username || 'U';
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}, [user]);

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center gap-2 border-b border-stone-100 p-3">
				{isExpanded ? (
					<>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-semibold text-stone-900">{projectName}</span>
							<span className="text-xs text-stone-500">Overview</span>
						</div>
						<button
							type="button"
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
							onClick={onToggleExpand}
						>
							<PanelLeftIcon />
						</button>
					</>
				) : (
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
						onClick={onToggleExpand}
					>
						<PanelLeftIcon />
					</button>
				)}
			</div>

			{/* New Button */}
			<div className="p-3">
				<button
					type="button"
					onClick={onNewClick}
					className={cn(
						'flex items-center justify-center rounded-lg bg-[#4d55cc] px-3 py-2 text-white hover:bg-[#3d45bc] transition-colors',
						isExpanded ? 'w-full gap-2' : 'h-10 w-10 p-0',
					)}
				>
					<PlusIcon className="h-4 w-4" />
					{isExpanded && <span className="text-sm font-medium">New</span>}
				</button>
			</div>

			{/* Tools Section - AI & Details */}
			<div className="px-2 pb-2">
				{isExpanded && (
					<div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
						Tools
					</div>
				)}
				<div className="space-y-1">
					{onOpenAI && (
						<button
							type="button"
							onClick={onOpenAI}
							className={cn(
								'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
								isAIOpen ? 'bg-[#eef0ff] text-[#4d55cc]' : 'text-stone-700 hover:bg-stone-100',
								!isExpanded && 'justify-center px-1',
							)}
							title="AI Assistant"
						>
							<BotIcon />
							{isExpanded && <span className="text-sm font-medium">AI</span>}
						</button>
					)}
					{onOpenDetails && (
						<button
							type="button"
							onClick={onOpenDetails}
							className={cn(
								'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
								isDetailsOpen ? 'bg-[#eef0ff] text-[#4d55cc]' : 'text-stone-700 hover:bg-stone-100',
								!isExpanded && 'justify-center px-1',
							)}
							title="Details"
						>
							<InfoIcon />
							{isExpanded && <span className="text-sm font-medium">Details</span>}
						</button>
					)}
				</div>
			</div>

			{/* Resource List */}
			<div className="flex-1 overflow-y-auto px-2">
				{isExpanded && (
					<div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
						Resources
					</div>
				)}
				<div className="space-y-1">
					{resources.map((resource) => (
						<ResourceItem
							key={resource.id}
							resource={resource}
							isActive={resource.id === activeResourceId}
							isExpanded={isExpanded}
							onClick={() => onResourceClick(resource)}
						/>
					))}
				</div>
			</div>

			{/* Footer - Collaboration & Account */}
			<div className="border-t border-stone-100 p-3">
				<div className={cn('flex items-center gap-2', !isExpanded && 'flex-col')}>
					{/* Collaborator Avatars */}
					{collaboration.collaborators.length > 0 && (
						<div className={cn('flex', isExpanded ? '-space-x-2' : 'flex-col gap-1')}>
							{collaboration.collaborators.slice(0, isExpanded ? 3 : 2).map((collab) => (
								<div
									key={collab.id}
									className="h-6 w-6 rounded-full bg-stone-200 ring-2 ring-white"
									title={collab.name}
								>
									{collab.avatarUrl ? (
										<img
											src={collab.avatarUrl}
											alt={collab.name}
											className="h-full w-full rounded-full object-cover"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-stone-600">
											{collab.name[0]?.toUpperCase()}
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{isExpanded && <div className="flex-1" />}

					{/* Share Button */}
					<button
						type="button"
						className={cn(
							'flex h-8 w-8 items-center justify-center rounded-lg',
							isShareOpen ? 'bg-[#eef0ff] text-[#4d55cc]' : 'text-stone-500 hover:bg-stone-100',
						)}
						onClick={collaboration.onShareClick}
						title="Share"
					>
						<ShareIcon />
					</button>

					{/* User Avatar */}
					<button
						type="button"
						className={cn(
							'flex h-8 w-8 items-center justify-center overflow-hidden rounded-full',
							isExpanded && 'ml-1',
						)}
						title="Account"
					>
						{user?.imageUrl ? (
							<img src={user.imageUrl} alt="Profile" className="h-full w-full object-cover" />
						) : (
							<div className="flex h-full w-full items-center justify-center bg-stone-900 text-xs font-semibold text-white">
								{initials}
							</div>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

interface ResourceItemProps {
	resource: ProjectResource;
	isActive: boolean;
	isExpanded: boolean;
	onClick: () => void;
}

function ResourceItem({ resource, isActive, isExpanded, onClick }: ResourceItemProps) {
	const Icon = RESOURCE_ICONS[resource.type];

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
				isActive ? 'bg-[#eef0ff] text-[#4d55cc]' : 'text-stone-700 hover:bg-stone-100',
				!isExpanded && 'justify-center px-1',
			)}
		>
			<Icon />
			{isExpanded && (
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium">{resource.name}</span>
				</div>
			)}
		</button>
	);
}

// Inline SVG Icons
function PanelLeftIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Toggle sidebar</title>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M9 3v18" />
		</svg>
	);
}

function PlusIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Add</title>
			<path d="M5 12h14" />
			<path d="M12 5v14" />
		</svg>
	);
}

function LayoutIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Resource</title>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M3 9h18" />
			<path d="M9 21V9" />
		</svg>
	);
}

function BotIcon() {
	return (
		<svg
			width="16"
			height="16"
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
			width="16"
			height="16"
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

function ShareIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Share</title>
			<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
			<polyline points="16 6 12 2 8 6" />
			<line x1="12" x2="12" y1="2" y2="15" />
		</svg>
	);
}
