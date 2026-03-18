const WORKSPACE_SETTINGS_KEY = 'dashboard-workspace-settings';
const PERSONAL_PREFERENCES_KEY = 'dashboard-personal-preferences';

export type ActiveView = 'menu' | 'workspace' | 'preferences';

export interface WorkspaceSettings {
	defaultCanvasVisibility: 'private' | 'public';
	showSharedCanvases: boolean;
}

export interface PersonalPreferences {
	emailDigests: boolean;
	reducedMotion: boolean;
}

export interface DashboardProfileMenuProps {
	displayName: string;
	email: string;
	imageUrl: string | null | undefined;
	initials: string;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
	defaultCanvasVisibility: 'private',
	showSharedCanvases: true,
};

export const DEFAULT_PERSONAL_PREFERENCES: PersonalPreferences = {
	emailDigests: true,
	reducedMotion: false,
};

export function readStoredValue<T extends object>(key: string, fallback: T): T {
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

export function writeStoredValue<T extends object>(key: string, value: T): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Silently fail if localStorage is not available
	}
}

export function getWorkspaceSettingsKey(): string {
	return WORKSPACE_SETTINGS_KEY;
}

export function getPersonalPreferencesKey(): string {
	return PERSONAL_PREFERENCES_KEY;
}

export function loadWorkspaceSettings(): WorkspaceSettings {
	return readStoredValue(WORKSPACE_SETTINGS_KEY, DEFAULT_WORKSPACE_SETTINGS);
}

export function loadPersonalPreferences(): PersonalPreferences {
	return readStoredValue(PERSONAL_PREFERENCES_KEY, DEFAULT_PERSONAL_PREFERENCES);
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
	writeStoredValue(WORKSPACE_SETTINGS_KEY, settings);
}

export function savePersonalPreferences(preferences: PersonalPreferences): void {
	writeStoredValue(PERSONAL_PREFERENCES_KEY, preferences);
}
