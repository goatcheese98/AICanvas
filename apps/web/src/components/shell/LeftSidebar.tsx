import { useUser } from '@clerk/clerk-react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NewResourceMenu, type NewResourceOption } from './NewResourceMenu';
import type { ProjectResource, ResourceType } from './types';
import { cn } from './utils';

interface LeftSidebarProps {
	isExpanded: boolean;
	onToggleExpand: () => void;
	projectName: string;
	resources: ProjectResource[];
	activeResourceId?: string;
	onResourceClick: (resource: ProjectResource) => void;
	onNewResource: (option: NewResourceOption) => void;
	onNavigateToSettings?: () => void;
	onOpenShortcutsHelp?: () => void;
	collaboration: {
		isCollaborating: boolean;
		collaborators: { id: string; name: string; avatarUrl?: string; isOnline?: boolean }[];
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
	document: LayoutIcon,
	prototype: LayoutIcon,
};

export function LeftSidebar({
	isExpanded,
	onToggleExpand,
	projectName,
	resources,
	activeResourceId,
	onResourceClick,
	onNewResource,
	onNavigateToSettings,
	onOpenShortcutsHelp,
	collaboration,
}: LeftSidebarProps) {
	const { user } = useUser();
	const [isFooterPopoverOpen, setIsFooterPopoverOpen] = useState(false);
	const [isAnimatingOut, setIsAnimatingOut] = useState(false);
	const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
	const popoverRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const newButtonRef = useRef<HTMLButtonElement>(null);

	const initials = useMemo(() => {
		const name = user?.fullName || user?.firstName || user?.username || 'U';
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}, [user]);

	const displayName = user?.fullName || user?.firstName || user?.username || 'User';

	const handleClosePopover = useCallback(() => {
		setIsAnimatingOut(true);
		// Wait for animation to complete before removing from DOM
		setTimeout(() => {
			setIsFooterPopoverOpen(false);
			setIsAnimatingOut(false);
		}, 150);
	}, []);

	const handleOpenPopover = useCallback(() => {
		setIsAnimatingOut(false);
		setIsFooterPopoverOpen(true);
	}, []);

	const handleTogglePopover = useCallback(() => {
		if (isFooterPopoverOpen) {
			handleClosePopover();
		} else {
			handleOpenPopover();
		}
	}, [isFooterPopoverOpen, handleClosePopover, handleOpenPopover]);

	const handleSettingsClick = useCallback(() => {
		handleClosePopover();
		// Delay navigation slightly to allow animation to complete
		setTimeout(() => {
			onNavigateToSettings?.();
		}, 150);
	}, [handleClosePopover, onNavigateToSettings]);

	// Close on escape key
	useEffect(() => {
		if (!isFooterPopoverOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				handleClosePopover();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isFooterPopoverOpen, handleClosePopover]);

	// Focus trap within popover
	useEffect(() => {
		if (!isFooterPopoverOpen || !popoverRef.current) return;

		const popover = popoverRef.current;
		const focusableElements = popover.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		// Focus first element when opened
		firstElement?.focus();

		const handleTabKey = (e: KeyboardEvent) => {
			if (e.key !== 'Tab') return;

			if (e.shiftKey && document.activeElement === firstElement) {
				e.preventDefault();
				lastElement?.focus();
			} else if (!e.shiftKey && document.activeElement === lastElement) {
				e.preventDefault();
				firstElement?.focus();
			}
		};

		document.addEventListener('keydown', handleTabKey);
		return () => document.removeEventListener('keydown', handleTabKey);
	}, [isFooterPopoverOpen]);

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
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
							onClick={onToggleExpand}
							aria-label="Collapse sidebar"
						>
							<PanelLeftIcon />
						</button>
					</>
				) : (
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
						onClick={onToggleExpand}
						aria-label="Expand sidebar"
					>
						<PanelLeftIcon />
					</button>
				)}
			</div>

			{/* New Button */}
			<div className="p-3">
				<button
					type="button"
					onClick={() => onNewResource({ type: 'quick-note' })}
					className={cn(
						'flex items-center justify-center rounded-lg bg-[#4d55cc] px-3 py-2 text-white transition-colors hover:bg-[#3d45bc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d55cc] focus-visible:ring-offset-2',
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
					ref={triggerRef}
					type="button"
					onClick={handleTogglePopover}
					aria-expanded={isFooterPopoverOpen}
					aria-haspopup="dialog"
					className={cn(
						'flex w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d55cc] focus-visible:ring-offset-2',
						!isExpanded && 'justify-center',
						isFooterPopoverOpen && 'bg-stone-100',
					)}
				>
					{/* User Avatar */}
					<div className="relative">
						<div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-2 ring-stone-100">
							{user?.imageUrl ? (
								<img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
							) : (
								<div className="flex h-full w-full items-center justify-center bg-stone-900 text-xs font-semibold text-white">
									{initials}
								</div>
							)}
						</div>
						{/* Presence indicator dot with pulse animation when collaborating */}
						<div
							className={cn(
								'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white transition-colors',
								collaboration.isCollaborating ? 'bg-green-500' : 'bg-stone-300',
							)}
						>
							{collaboration.isCollaborating && (
								<span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
							)}
						</div>
					</div>

					{/* Collaborator Avatars (stacked) */}
					{collaboration.collaborators.length > 0 && (
						<div className={cn('flex -space-x-2', !isExpanded && 'hidden')}>
							{collaboration.collaborators.slice(0, 2).map((collab) => (
								<div
									key={collab.id}
									className="relative h-6 w-6 rounded-full bg-stone-200 ring-2 ring-white"
									title={collab.name}
								>
									{collab.avatarUrl ? (
										<img
											src={collab.avatarUrl}
											alt=""
											className="h-full w-full rounded-full object-cover"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-stone-600">
											{collab.name[0]?.toUpperCase()}
										</div>
									)}
									{/* Online indicator for collaborators */}
									{collab.isOnline !== false && (
										<span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-white" />
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
						<div
							className={cn(
								'transition-colors',
								collaboration.isCollaborating ? 'text-green-500' : 'text-stone-400',
							)}
						>
							<ShareIcon className="h-4 w-4" />
						</div>
					)}
				</button>

				{/* Footer Popover */}
				{(isFooterPopoverOpen || isAnimatingOut) && (
					<>
						{/* Backdrop to close popover */}
						<button
							type="button"
							className={cn(
								'fixed inset-0 z-40 bg-transparent transition-opacity duration-150',
								isAnimatingOut ? 'opacity-0' : 'opacity-100',
							)}
							onClick={handleClosePopover}
							aria-label="Close menu"
							tabIndex={-1}
						/>
						<div
							ref={popoverRef}
							role="dialog"
							aria-label="Account and collaboration menu"
							className={cn(
								'absolute bottom-full z-50 mb-2 w-72 rounded-xl border border-stone-200 bg-white p-3 shadow-lg',
								'origin-bottom-left transition-all duration-150 ease-out',
								isAnimatingOut
									? 'opacity-0 scale-95 translate-y-1'
									: 'opacity-100 scale-100 translate-y-0',
								// Position: left-aligned in expanded, right-aligned (off-sidebar) when collapsed
								isExpanded ? 'left-0' : 'left-14',
								// Mobile: ensure it doesn't go off-screen
								'sm:w-72 w-[calc(100vw-5rem)] max-w-xs',
							)}
						>
							{/* Account Section */}
							<div className="flex items-center gap-3 border-b border-stone-100 pb-3">
								<div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-stone-100">
									{user?.imageUrl ? (
										<img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
									) : (
										<div className="flex h-full w-full items-center justify-center bg-stone-900 text-sm font-semibold text-white">
											{initials}
										</div>
									)}
									{/* Presence indicator */}
									<div
										className={cn(
											'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
											collaboration.isCollaborating ? 'bg-green-500' : 'bg-stone-300',
										)}
									>
										{collaboration.isCollaborating && (
											<span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
										)}
									</div>
								</div>
								<div className="flex-1 min-w-0">
									<p className="truncate text-sm font-medium text-stone-900">{displayName}</p>
									<div className="flex items-center gap-1.5">
										<span
											className={cn(
												'h-1.5 w-1.5 rounded-full',
												collaboration.isCollaborating ? 'bg-green-500' : 'bg-stone-300',
											)}
										/>
										<p className="truncate text-xs text-stone-500">
											{collaboration.isCollaborating ? 'Live session active' : 'Working solo'}
										</p>
									</div>
								</div>
							</div>

							{/* Collaborators Section */}
							<div className="border-b border-stone-100 py-3">
								<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
									Collaborators
								</p>
								{collaboration.collaborators.length > 0 ? (
									<div className="space-y-2">
										{collaboration.collaborators.map((collab) => (
											<div key={collab.id} className="flex items-center gap-2">
												<div className="relative h-6 w-6 rounded-full bg-stone-200">
													{collab.avatarUrl ? (
														<img
															src={collab.avatarUrl}
															alt=""
															className="h-full w-full rounded-full object-cover"
														/>
													) : (
														<div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-stone-600">
															{collab.name[0]?.toUpperCase()}
														</div>
													)}
													<span
														className={cn(
															'absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white',
															collab.isOnline !== false ? 'bg-green-500' : 'bg-stone-300',
														)}
													/>
												</div>
												<span className="text-sm text-stone-700">{collab.name}</span>
											</div>
										))}
									</div>
								) : (
									<div className="flex flex-col items-center gap-2 py-3 text-center">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-50">
											<UsersIcon className="h-5 w-5 text-stone-300" />
										</div>
										<p className="text-xs text-stone-400">No collaborators yet</p>
										<p className="text-[11px] text-stone-300">
											Start a live session to invite others
										</p>
									</div>
								)}
							</div>

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
												className="shrink-0 rounded px-2 py-1 text-[11px] font-medium text-[#4d55cc] transition-colors hover:bg-stone-100 hover:text-[#3d45bc]"
											>
												Copy
											</button>
										</div>
										<button
											type="button"
											onClick={() => {
												void collaboration.stopSession();
											}}
											className="w-full rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
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
											className="w-full rounded-lg bg-[#4d55cc] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#3d45bc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d55cc] focus-visible:ring-offset-2"
										>
											Start Live Session
										</button>
									</div>
								)}
								<div className="mt-3">
									<label
										htmlFor="display-name"
										className="block text-[11px] font-medium text-stone-500 mb-1"
									>
										Display Name
									</label>
									<input
										id="display-name"
										type="text"
										value={collaboration.username}
										onChange={(e) => collaboration.setUsername(e.target.value)}
										className="w-full rounded-lg border border-stone-200 px-2.5 py-2 text-xs text-stone-700 transition-colors focus:border-[#4d55cc] focus:outline-none focus:ring-1 focus:ring-[#4d55cc]"
										placeholder="Your name"
									/>
								</div>
							</div>

							{/* Actions */}
							<div className="pt-2 space-y-1">
								<button
									type="button"
									className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d55cc] focus-visible:ring-offset-2"
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
				'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d55cc] focus-visible:ring-offset-1',
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
			aria-hidden="true"
		>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M9 3v18" />
		</svg>
	);
}

/**
 * Export the NewResourceOption type for use in other components
 */
export type { NewResourceOption };

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
			aria-hidden="true"
		>
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
			aria-hidden="true"
		>
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
			aria-hidden="true"
		>
			<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
			<polyline points="16 6 12 2 8 6" />
			<line x1="12" x2="12" y1="2" y2="15" />
		</svg>
	);
}

function UsersIcon({ className }: { className?: string }) {
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
			aria-hidden="true"
		>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}
