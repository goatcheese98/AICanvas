/**
 * Keyboard shortcuts configuration and utilities
 *
 * Centralized definition of all keyboard shortcuts in the application
 * with platform-aware formatting.
 */

export type ShortcutContext = 'global' | 'canvas' | 'shell' | 'navigation' | 'help' | 'panels';

export interface KeyboardShortcut {
	/** Unique identifier for the shortcut */
	id: string;
	/** Key combination (e.g., 'mod+b', 'mod+i', '?') - 'mod' represents Cmd on Mac, Ctrl on others */
	key: string;
	/** Human-readable description of what the shortcut does */
	description: string;
	/** Category/context where the shortcut applies */
	context: ShortcutContext;
	/** Alternative keys that trigger the same action (e.g., ['Escape', 'Esc']) */
	altKeys?: string[];
}

/**
 * All keyboard shortcuts defined in the application
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
	// Navigation
	{
		id: 'toggle-sidebar',
		key: 'mod+[',
		description: 'Toggle sidebar',
		context: 'navigation',
	},
	{
		id: 'close-panel',
		key: 'Escape',
		description: 'Close panels / exit expanded view',
		context: 'navigation',
	},

	// Panels
	{
		id: 'open-ai-panel',
		key: 'mod+b',
		description: 'Open AI Assistant panel',
		context: 'panels',
	},
	{
		id: 'open-details-panel',
		key: 'mod+i',
		description: 'Open Details panel',
		context: 'panels',
	},

	// Help
	{
		id: 'show-shortcuts-help',
		key: '?',
		description: 'Show keyboard shortcuts',
		context: 'help',
	},
] as const;

/**
 * Group shortcuts by their context for organized display
 */
export function groupShortcutsByContext(
	shortcuts: KeyboardShortcut[],
): Record<ShortcutContext, KeyboardShortcut[]> {
	return shortcuts.reduce(
		(groups, shortcut) => {
			if (!groups[shortcut.context]) {
				groups[shortcut.context] = [];
			}
			groups[shortcut.context].push(shortcut);
			return groups;
		},
		{} as Record<ShortcutContext, KeyboardShortcut[]>,
	);
}

/**
 * Check if the current platform is macOS
 */
export function isMac(): boolean {
	if (typeof navigator === 'undefined') return false;
	return navigator.platform.toLowerCase().includes('mac');
}

/**
 * Get the modifier key symbol/label for the current platform
 * Returns '⌘' for Mac, 'Ctrl' for others
 */
export function getModKey(): string {
	return isMac() ? '⌘' : 'Ctrl';
}

/**
 * Format a key combination for display
 * Converts 'mod+b' to '⌘B' on Mac or 'Ctrl+B' on others
 */
export function formatShortcut(key: string): string {
	const modKey = getModKey();
	return key.replace('mod', modKey).toUpperCase();
}

/**
 * Parse a key string into an array of key labels for display
 * e.g., 'mod+b' -> ['⌘', 'B'] or ['Ctrl', 'B']
 */
export function parseShortcutKeys(key: string): string[] {
	const parts = key.split('+');
	return parts.map((part) => {
		if (part === 'mod') return getModKey();
		// Capitalize single letters, keep special keys as-is
		if (part.length === 1 && /[a-z]/.test(part)) {
			return part.toUpperCase();
		}
		return part;
	});
}

/**
 * Find a shortcut by its ID
 */
export function getShortcutById(id: string): KeyboardShortcut | undefined {
	return KEYBOARD_SHORTCUTS.find((s) => s.id === id);
}

/**
 * Find shortcuts by context
 */
export function getShortcutsByContext(context: ShortcutContext): KeyboardShortcut[] {
	return KEYBOARD_SHORTCUTS.filter((s) => s.context === context);
}

/**
 * Context display names for the UI
 */
export const CONTEXT_DISPLAY_NAMES: Record<ShortcutContext, string> = {
	global: 'Global',
	canvas: 'Canvas',
	shell: 'Shell',
	navigation: 'Navigation',
	help: 'Help',
	panels: 'Panels',
};

/**
 * Order of contexts for display in the help dialog
 */
export const CONTEXT_DISPLAY_ORDER: ShortcutContext[] = ['navigation', 'panels', 'help'];
