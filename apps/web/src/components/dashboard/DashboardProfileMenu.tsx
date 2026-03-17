import { useClerk } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';

const WORKSPACE_SETTINGS_KEY = 'dashboard-workspace-settings';
const PERSONAL_PREFERENCES_KEY = 'dashboard-personal-preferences';

type ActiveView = 'menu' | 'workspace' | 'preferences';

interface WorkspaceSettings {
	defaultCanvasVisibility: 'private' | 'public';
	showSharedCanvases: boolean;
}

interface PersonalPreferences {
	emailDigests: boolean;
	reducedMotion: boolean;
}

interface DashboardProfileMenuProps {
	displayName: string;
	email: string;
	imageUrl: string | null | undefined;
	initials: string;
}

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
	defaultCanvasVisibility: 'private',
	showSharedCanvases: true,
};

const DEFAULT_PERSONAL_PREFERENCES: PersonalPreferences = {
	emailDigests: true,
	reducedMotion: false,
};

function readStoredValue<T extends object>(key: string, fallback: T): T {
	if (typeof window === 'undefined') {
		return fallback;
	}

	try {
		const rawValue = window.localStorage.getItem(key);
		if (!rawValue) {
			return fallback;
		}

		const parsedValue = JSON.parse(rawValue) as Partial<T> | null;
		if (!parsedValue || typeof parsedValue !== 'object') {
			return fallback;
		}

		return {
			...fallback,
			...parsedValue,
		};
	} catch {
		return fallback;
	}
}

function ChevronRightIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 20 20"
			className="h-4 w-4 text-[var(--color-text-secondary)]"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
		>
			<path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function ChevronDownIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 20 20"
			className="h-4 w-4 text-[var(--color-text-secondary)]"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
		>
			<path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 20 20"
			className="h-4 w-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
		>
			<path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
		</svg>
	);
}

function BackIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 20 20"
			className="h-4 w-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
		>
			<path d="m11.5 4.5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function ToggleRow({
	description,
	isEnabled,
	label,
	onToggle,
}: {
	description: string;
	isEnabled: boolean;
	label: string;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className="flex w-full items-start justify-between gap-4 rounded-[16px] border border-[var(--color-border)] bg-white/80 px-4 py-4 text-left transition hover:border-[var(--color-accent-border)] hover:bg-white"
		>
			<div>
				<div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
				<div className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
					{description}
				</div>
			</div>
			<div
				aria-hidden="true"
				className={`mt-1 inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
					isEnabled
						? 'bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
						: 'bg-slate-100 text-slate-500'
				}`}
			>
				{isEnabled ? 'On' : 'Off'}
			</div>
		</button>
	);
}

function MenuAction({
	description,
	label,
	onClick,
}: {
	description: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full items-start justify-between gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[var(--color-accent-bg)]/65"
		>
			<div>
				<div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
				<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
					{description}
				</div>
			</div>
			<div className="mt-0.5 shrink-0">
				<ChevronRightIcon />
			</div>
		</button>
	);
}

function PanelHeader({
	description,
	onBack,
	onClose,
	title,
}: {
	description: string;
	onBack: () => void;
	onClose: () => void;
	title: string;
}) {
	return (
		<div className="border-b border-[var(--color-border)] px-3 pb-4 pt-3">
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					aria-label="Go back"
					onClick={onBack}
					className="inline-flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-accent-bg)]/65 hover:text-[var(--color-text-primary)]"
				>
					<BackIcon />
					Back
				</button>
				<button
					type="button"
					aria-label="Close profile menu"
					onClick={onClose}
					className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-accent-bg)]/65 hover:text-[var(--color-text-primary)]"
				>
					<CloseIcon />
				</button>
			</div>

			<div className="px-2 pt-3">
				<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
					Profile Settings
				</div>
				<h2 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
				<p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
			</div>
		</div>
	);
}

export function DashboardProfileMenu({
	displayName,
	email,
	imageUrl,
	initials,
}: DashboardProfileMenuProps) {
	const { redirectToUserProfile, signOut } = useClerk();
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [activeView, setActiveView] = useState<ActiveView>('menu');
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [workspaceSettings, setWorkspaceSettings] = useState(() =>
		readStoredValue(WORKSPACE_SETTINGS_KEY, DEFAULT_WORKSPACE_SETTINGS),
	);
	const [personalPreferences, setPersonalPreferences] = useState(() =>
		readStoredValue(PERSONAL_PREFERENCES_KEY, DEFAULT_PERSONAL_PREFERENCES),
	);

	const closeMenu = () => {
		setIsMenuOpen(false);
		setActiveView('menu');
	};

	useEffect(() => {
		if (!isMenuOpen) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) {
				closeMenu();
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeMenu();
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [isMenuOpen]);

	useEffect(() => {
		window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(workspaceSettings));
	}, [workspaceSettings]);

	useEffect(() => {
		window.localStorage.setItem(PERSONAL_PREFERENCES_KEY, JSON.stringify(personalPreferences));
	}, [personalPreferences]);

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				aria-expanded={isMenuOpen}
				aria-haspopup="dialog"
				aria-label="Open profile menu"
				onClick={() => {
					if (isMenuOpen) {
						closeMenu();
						return;
					}
					setIsMenuOpen(true);
				}}
				className="flex min-w-[16rem] max-w-[18rem] items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-white/82 px-2.5 py-2 pr-3 shadow-sm transition hover:border-[var(--color-accent-border)] hover:bg-white"
			>
				{imageUrl ? (
					<img src={imageUrl} alt="" className="h-10 w-10 rounded-[10px] object-cover" />
				) : (
					<div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-accent-bg)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]">
						{initials}
					</div>
				)}

				<div className="min-w-0 flex-1 text-left">
					<div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
						{displayName}
					</div>
					<div className="truncate text-xs text-[var(--color-text-secondary)]">{email}</div>
				</div>

				<div className="shrink-0">
					<ChevronDownIcon />
				</div>
			</button>

			{isMenuOpen ? (
				<div
					role="dialog"
					aria-label={
						activeView === 'menu'
							? 'Profile menu'
							: activeView === 'workspace'
								? 'Workspace settings'
								: 'Preferences'
					}
					className="app-panel app-panel-strong absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[24rem] overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-white/96 shadow-[0_24px_64px_rgba(15,23,42,0.16)] backdrop-blur"
				>
					{activeView === 'menu' ? (
						<>
							<div className="border-b border-[var(--color-border)] px-3 pb-4 pt-3">
								<div className="flex items-start justify-between gap-3 rounded-[14px] bg-[var(--color-accent-bg)]/60 px-4 py-4">
									<div className="flex min-w-0 items-center gap-3">
										{imageUrl ? (
											<img
												src={imageUrl}
												alt=""
												className="h-12 w-12 rounded-[12px] object-cover"
											/>
										) : (
											<div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]">
												{initials}
											</div>
										)}
										<div className="min-w-0">
											<div className="truncate text-base font-semibold text-[var(--color-text-primary)]">
												{displayName}
											</div>
											<div className="truncate text-sm text-[var(--color-text-secondary)]">
												{email}
											</div>
										</div>
									</div>

									<button
										type="button"
										aria-label="Close profile menu"
										onClick={closeMenu}
										className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--color-text-secondary)] transition hover:bg-white/80 hover:text-[var(--color-text-primary)]"
									>
										<CloseIcon />
									</button>
								</div>
							</div>

							<div className="px-2 pb-2 pt-3">
								<div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
									Account
								</div>

								<div className="space-y-1">
									<MenuAction
										label="Manage account"
										description="Update your profile, password, and connected sign-in methods."
										onClick={() => {
											closeMenu();
											void redirectToUserProfile();
										}}
									/>
									<MenuAction
										label="Workspace settings"
										description="Choose your default canvas sharing mode and library behavior."
										onClick={() => setActiveView('workspace')}
									/>
									<MenuAction
										label="Preferences"
										description="Adjust personal dashboard preferences without leaving this page."
										onClick={() => setActiveView('preferences')}
									/>
								</div>
							</div>

							<div className="border-t border-[var(--color-border)] px-2 py-2">
								<button
									type="button"
									onClick={() => void signOut()}
									className="flex w-full items-start rounded-[12px] px-3 py-3 text-left transition hover:bg-[var(--color-danger-bg)]"
								>
									<div>
										<div className="text-sm font-semibold text-[var(--color-danger-text)]">
											Sign out
										</div>
										<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
											End this session and return to the sign-in screen.
										</div>
									</div>
								</button>
							</div>
						</>
					) : null}

					{activeView === 'workspace' ? (
						<>
							<PanelHeader
								title="Workspace settings"
								description="A couple of shared workspace defaults that are reasonable to manage from your profile menu."
								onBack={() => setActiveView('menu')}
								onClose={closeMenu}
							/>

							<div className="space-y-4 px-3 py-4">
								<div>
									<label className="mb-2 block px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
										Default sharing
									</label>
									<div className="grid gap-2">
										<button
											type="button"
											onClick={() =>
												setWorkspaceSettings((current) => ({
													...current,
													defaultCanvasVisibility: 'private',
												}))
											}
											className={`rounded-[14px] border px-4 py-3 text-left transition ${
												workspaceSettings.defaultCanvasVisibility === 'private'
													? 'border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
													: 'border-[var(--color-border)] bg-white/80 text-[var(--color-text-primary)] hover:border-[var(--color-accent-border)]'
											}`}
										>
											<div className="text-sm font-semibold">Private first</div>
											<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
												New canvases stay personal until you intentionally share them.
											</div>
										</button>
										<button
											type="button"
											onClick={() =>
												setWorkspaceSettings((current) => ({
													...current,
													defaultCanvasVisibility: 'public',
												}))
											}
											className={`rounded-[14px] border px-4 py-3 text-left transition ${
												workspaceSettings.defaultCanvasVisibility === 'public'
													? 'border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
													: 'border-[var(--color-border)] bg-white/80 text-[var(--color-text-primary)] hover:border-[var(--color-accent-border)]'
											}`}
										>
											<div className="text-sm font-semibold">Public by default</div>
											<div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
												Useful if your canvases are mostly for demos, reviews, or open
												collaboration.
											</div>
										</button>
									</div>
								</div>

								<ToggleRow
									label="Show shared canvases in the library"
									description="Keep canvases from teammates visible alongside your own work."
									isEnabled={workspaceSettings.showSharedCanvases}
									onToggle={() =>
										setWorkspaceSettings((current) => ({
											...current,
											showSharedCanvases: !current.showSharedCanvases,
										}))
									}
								/>
							</div>
						</>
					) : null}

					{activeView === 'preferences' ? (
						<>
							<PanelHeader
								title="Preferences"
								description="Personal dashboard settings that make sense to adjust quickly and back out of."
								onBack={() => setActiveView('menu')}
								onClose={closeMenu}
							/>

							<div className="space-y-4 px-3 py-4">
								<ToggleRow
									label="Email digests"
									description="Receive a summary when activity picks up across your canvases."
									isEnabled={personalPreferences.emailDigests}
									onToggle={() =>
										setPersonalPreferences((current) => ({
											...current,
											emailDigests: !current.emailDigests,
										}))
									}
								/>
								<ToggleRow
									label="Reduced motion"
									description="Tone down animated transitions when you want a steadier interface."
									isEnabled={personalPreferences.reducedMotion}
									onToggle={() =>
										setPersonalPreferences((current) => ({
											...current,
											reducedMotion: !current.reducedMotion,
										}))
									}
								/>
							</div>
						</>
					) : null}
				</div>
			) : null}
		</div>
	);
}
