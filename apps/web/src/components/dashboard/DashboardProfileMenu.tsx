import { useClerk } from '@clerk/clerk-react';
import { useDashboardProfileMenuState } from './useDashboardProfileMenuState';
import { DashboardProfileTrigger } from './DashboardProfileTrigger';
import { MenuContent } from './DashboardProfileMenuContent';
import { WorkspaceSettingsView } from './DashboardProfileWorkspaceView';
import { PreferencesView } from './DashboardProfilePreferencesView';
import { useMountEffect } from '@/hooks/useMountEffect';
import type { DashboardProfileMenuProps } from './dashboard-profile-utils';

export type { DashboardProfileMenuProps } from './dashboard-profile-utils';

export function DashboardProfileMenu({
	displayName,
	email,
	imageUrl,
	initials,
}: DashboardProfileMenuProps) {
	const { signOut } = useClerk();
	const {
		menuRef,
		activeView,
		isMenuOpen,
		workspaceSettings,
		personalPreferences,
		closeMenu,
		toggleMenu,
		setActiveView,
		updateWorkspaceSettings,
		updatePersonalPreferences,
	} = useDashboardProfileMenuState();

	// Handle click-outside and escape key - this is one-time DOM setup
	// which is the only allowed useEffect pattern (via useMountEffect)
	useMountEffect(() => {
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
	});

	const getAriaLabel = () => {
		switch (activeView) {
			case 'menu':
				return 'Profile menu';
			case 'workspace':
				return 'Workspace settings';
			case 'preferences':
				return 'Preferences';
			default:
				return 'Profile menu';
		}
	};

	return (
		<div className="relative" ref={menuRef}>
			<DashboardProfileTrigger
				displayName={displayName}
				email={email}
				imageUrl={imageUrl}
				initials={initials}
				isMenuOpen={isMenuOpen}
				onClick={toggleMenu}
			/>

			{isMenuOpen ? (
				<div
					role="dialog"
					aria-label={getAriaLabel()}
					className="app-panel app-panel-strong absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[24rem] overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-white/96 shadow-[0_24px_64px_rgba(15,23,42,0.16)] backdrop-blur"
				>
					{activeView === 'menu' ? (
						<MenuContent
							displayName={displayName}
							email={email}
							imageUrl={imageUrl}
							initials={initials}
							onClose={closeMenu}
							onNavigate={setActiveView}
						/>
					) : null}

					{activeView === 'workspace' ? (
						<WorkspaceSettingsView
							settings={workspaceSettings}
							onBack={() => setActiveView('menu')}
							onClose={closeMenu}
							onUpdateSettings={updateWorkspaceSettings}
						/>
					) : null}

					{activeView === 'preferences' ? (
						<PreferencesView
							preferences={personalPreferences}
							onBack={() => setActiveView('menu')}
							onClose={closeMenu}
							onUpdatePreferences={updatePersonalPreferences}
						/>
					) : null}
				</div>
			) : null}
		</div>
	);
}
