import { useUser } from '@clerk/clerk-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
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
	onNavigateToSettings?: () => void;
	collaboration: {
		isCollaborating: boolean;
		collaborators: { id: string; name: string; avatarUrl?: string }[];
		roomLink: string | null;
		username: string;
		setUsername: (name: string) => void;
		startSession: () => Promise<void>;
		stopSession: () => void;
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
	onNavigateToSettings,
	collaboration,
}: LeftSidebarProps) {
	const { user } = useUser();
	const [isFooterPopoverOpen, setIsFooterPopoverOpen] = useState(false);

	const initials = useMemo(() => {
		const name = user?.fullName || user?.firstName || user?.username || 'U';
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}, [user]);

	const displayName = user?.fullName || user?.firstName || user?.username || 'User';

	const handleSettingsClick = () => {
		setIsFooterPopoverOpen(false);
		onNavigateToSettings?.();
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center gap-2 border-b border-stone-100 p-3">
				{isExpanded ? (
					<>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-semibold text-stone-900">{projectName}</span>
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

			{/* Footer - Account/Presence/Share Popover */}
			<div className="relative border-t border-stone-100 p-3">
				<button
					type="button"
					onClick={() => setIsFooterPopoverOpen(!isFooterPopoverOpen)}
					className={cn(
						'flex w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-stone-100',
						!isExpanded && 'justify-center',
					)}
				>
					{/* User Avatar */}
					<div className="relative">
						<div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
							{user?.imageUrl ? (
								<img src={user.imageUrl} alt="Profile" className="h-full w-full object-cover" />
							) : (
								<div className="flex h-full w-full items-center justify-center bg-stone-900 text-xs font-semibold text-white">
									{initials}
								</div>
							)}
						</div>
						{/* Presence indicator dot */}
						<div
							className={cn(
								'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
								collaboration.isCollaborating ? 'bg-green-500' : 'bg-stone-300',
							)}
						/>
					</div>

					{/* Collaborator Avatars (stacked) */}
					{collaboration.collaborators.length > 0 && (
						<div className={cn('flex -space-x-2', !isExpanded && 'hidden')}>
							{collaboration.collaborators.slice(0, 2).map((collab) => (
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
							{collaboration.collaborators.length > 2 && (
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-[10px] font-medium text-stone-500 ring-2 ring-white">
									+{collaboration.collaborators.length - 2}
								</div>
							)}
						</div>
					)}

					{isExpanded && <div className="flex-1" />}

					{/* Share icon indicator (subtle) */}
					{isExpanded && (
						<div className="text-stone-400">
							<ShareIcon className="h-4 w-4" />
						</div>
					)}
				</button>

				{/* Footer Popover */}
				{isFooterPopoverOpen && (
					<>
						{/* Backdrop to close popover */}
						<button
							type="button"
							className="fixed inset-0 z-40"
							onClick={() => setIsFooterPopoverOpen(false)}
							aria-label="Close menu"
						/>
						<div
							className={cn(
								'absolute bottom-full z-50 mb-2 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg',
								isExpanded ? 'left-0' : 'left-14',
							)}
						>
							{/* Account Section */}
							<div className="flex items-center gap-3 border-b border-stone-100 pb-3">
								<div className="h-10 w-10 overflow-hidden rounded-full">
									{user?.imageUrl ? (
										<img src={user.imageUrl} alt="Profile" className="h-full w-full object-cover" />
									) : (
										<div className="flex h-full w-full items-center justify-center bg-stone-900 text-sm font-semibold text-white">
											{initials}
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<p className="truncate text-sm font-medium text-stone-900">{displayName}</p>
									<p className="truncate text-xs text-stone-500">
										{collaboration.isCollaborating ? 'Live session active' : 'Working solo'}
									</p>
								</div>
							</div>

							{/* Collaborators Section */}
							{collaboration.collaborators.length > 0 && (
								<div className="border-b border-stone-100 py-3">
									<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
										Collaborators
									</p>
									<div className="space-y-2">
										{collaboration.collaborators.map((collab) => (
											<div key={collab.id} className="flex items-center gap-2">
												<div className="h-6 w-6 rounded-full bg-stone-200">
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
												<span className="text-sm text-stone-700">{collab.name}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Share/Invite Section */}
							<div className="border-b border-stone-100 py-3">
								<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
									Share & Collaborate
								</p>
								{collaboration.roomLink ? (
									<div className="space-y-2">
										<div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
											<div className="flex-1 min-w-0">
												<p className="truncate text-xs text-stone-600">{collaboration.roomLink}</p>
											</div>
											<button
												type="button"
												onClick={() => {
													void navigator.clipboard.writeText(collaboration.roomLink ?? '');
												}}
												className="shrink-0 text-[11px] font-medium text-[#4d55cc] hover:text-[#3d45bc]"
											>
												Copy
											</button>
										</div>
										<button
											type="button"
											onClick={() => {
												void collaboration.stopSession();
											}}
											className="w-full rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-200"
										>
											End Session
										</button>
									</div>
								) : (
									<div className="space-y-2">
										<button
											type="button"
											onClick={() => {
												void collaboration.startSession();
											}}
											className="w-full rounded-lg bg-[#4d55cc] px-3 py-2 text-xs font-medium text-white hover:bg-[#3d45bc]"
										>
											Start Live Session
										</button>
									</div>
								)}
								<div className="mt-2">
									<label className="block text-[11px] font-medium text-stone-500 mb-1">
										Display Name
									</label>
									<input
										type="text"
										value={collaboration.username}
										onChange={(e) => collaboration.setUsername(e.target.value)}
										className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-700 focus:border-[#4d55cc] focus:outline-none"
										placeholder="Your name"
									/>
								</div>
							</div>

							{/* Actions */}
							<div className="pt-2 space-y-1">
								<button
									type="button"
									className="w-full rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
									onClick={handleSettingsClick}
								>
									Settings
								</button>
							</div>
						</div>
					</>
				)}
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

function ShareIcon({ className }: { className?: string }) {
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
			<title>Share</title>
			<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
			<polyline points="16 6 12 2 8 6" />
			<line x1="12" x2="12" y1="2" y2="15" />
		</svg>
	);
}
