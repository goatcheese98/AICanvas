import { useCallback, useRef, useState } from 'react';
import type { ActiveView, PersonalPreferences, WorkspaceSettings } from './dashboard-profile-utils';
import {
	loadPersonalPreferences,
	loadWorkspaceSettings,
	savePersonalPreferences,
	saveWorkspaceSettings,
} from './dashboard-profile-utils';

interface UseDashboardProfileMenuStateReturn {
	// Refs
	menuRef: React.RefObject<HTMLDivElement | null>;

	// State
	activeView: ActiveView;
	isMenuOpen: boolean;
	workspaceSettings: WorkspaceSettings;
	personalPreferences: PersonalPreferences;

	// Actions
	closeMenu: () => void;
	openMenu: () => void;
	toggleMenu: () => void;
	setActiveView: (view: ActiveView) => void;
	updateWorkspaceSettings: (updater: (current: WorkspaceSettings) => WorkspaceSettings) => void;
	updatePersonalPreferences: (
		updater: (current: PersonalPreferences) => PersonalPreferences,
	) => void;
}

// Stable initial values - only computed once
const initialWorkspaceSettings = loadWorkspaceSettings();
const initialPersonalPreferences = loadPersonalPreferences();

export function useDashboardProfileMenuState(): UseDashboardProfileMenuStateReturn {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [activeView, setActiveView] = useState<ActiveView>('menu');
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	// Use lazy initialization for state to avoid recomputing on every render
	const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(
		() => initialWorkspaceSettings,
	);

	const [personalPreferences, setPersonalPreferences] = useState<PersonalPreferences>(
		() => initialPersonalPreferences,
	);

	const updateWorkspaceSettings = useCallback(
		(updater: (current: WorkspaceSettings) => WorkspaceSettings) => {
			setWorkspaceSettings((current) => {
				const newValue = updater(current);
				saveWorkspaceSettings(newValue);
				return newValue;
			});
		},
		[],
	);

	const updatePersonalPreferences = useCallback(
		(updater: (current: PersonalPreferences) => PersonalPreferences) => {
			setPersonalPreferences((current) => {
				const newValue = updater(current);
				savePersonalPreferences(newValue);
				return newValue;
			});
		},
		[],
	);

	const closeMenu = useCallback(() => {
		setIsMenuOpen(false);
		setActiveView('menu');
	}, []);

	const openMenu = useCallback(() => {
		setIsMenuOpen(true);
	}, []);

	const toggleMenu = useCallback(() => {
		setIsMenuOpen((current) => {
			if (current) {
				// Closing the menu
				setActiveView('menu');
				return false;
			}
			return true;
		});
	}, []);

	return {
		menuRef,
		activeView,
		isMenuOpen,
		workspaceSettings,
		personalPreferences,
		closeMenu,
		openMenu,
		toggleMenu,
		setActiveView,
		updateWorkspaceSettings,
		updatePersonalPreferences,
	};
}
