export const TOOLBAR_HEIGHT = 34;
export const OFFSET_Y = 8;
export const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
export const ACCENT_TEXT = '#4d55cc';
export const ACCENT_BG = '#eef0ff';

export const TEXT_COLORS = [
	'#000000',
	'#374151',
	'#dc2626',
	'#ea580c',
	'#ca8a04',
	'#16a34a',
	'#2563eb',
	'#7c3aed',
];

export interface Position {
	top: number;
	left: number;
}

/**
 * Compute the position for the floating toolbar based on selection rect.
 * Positions toolbar above selection, or below if not enough space.
 */
export function computePosition(rect: DOMRect, toolbarWidth: number): Position {
	let top = rect.top - TOOLBAR_HEIGHT - OFFSET_Y;
	if (top < 8) top = rect.bottom + OFFSET_Y;
	let left = rect.left + rect.width / 2 - toolbarWidth / 2;
	left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
	return { top, left };
}

/**
 * Request a URL from the user for link creation.
 * Returns null if user cancels or enters empty string.
 */
export function requestLinkUrl(): string | null {
	const value = window.prompt('Enter a URL', 'https://');
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

/**
 * Check if a DOM selection is valid for showing the toolbar.
 * Selection must exist, not be collapsed, and have non-empty text.
 */
export function isValidSelection(domSelection: Selection | null): boolean {
	if (!domSelection) return false;
	if (domSelection.isCollapsed) return false;
	if (domSelection.rangeCount === 0) return false;
	if (domSelection.toString().trim() === '') return false;
	return true;
}

/**
 * Get the bounding client rect from the current DOM selection.
 * Returns null if no valid selection exists.
 */
export function getSelectionRect(): DOMRect | null {
	const domSelection = window.getSelection();
	if (!domSelection || domSelection.rangeCount === 0) return null;
	const rect = domSelection.getRangeAt(0).getBoundingClientRect();
	if (rect.width <= 0 && rect.height <= 0) return null;
	return rect;
}
