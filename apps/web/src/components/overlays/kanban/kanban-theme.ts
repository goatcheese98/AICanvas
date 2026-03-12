export const KANBAN_ACCENT_SURFACE_SOFT = 'color-mix(in srgb, var(--color-accent-bg) 10%, white)';
export const KANBAN_ACCENT_SURFACE = 'color-mix(in srgb, var(--color-accent-bg) 16%, white)';
export const KANBAN_ACCENT_SURFACE_STRONG = 'color-mix(in srgb, var(--color-accent-bg) 24%, white)';
export const KANBAN_ACCENT_BORDER =
	'color-mix(in srgb, var(--color-accent-border) 34%, var(--color-border))';
export const KANBAN_ACCENT_TEXT =
	'color-mix(in srgb, var(--color-accent-text) 24%, var(--color-text-secondary))';

export const KANBAN_FONT_SIZE_RANGE = {
	min: 12,
	max: 18,
	default: 14,
} as const;

export interface KanbanBackgroundTheme {
	id: string;
	label: string;
	description: string;
	swatch: string;
	boardBackground: string;
	headerBackground: string;
	columnBackground: string;
	cardBackground: string;
	borderTone: string;
}

export interface KanbanFontOption {
	id: string;
	label: string;
	family: string;
}

export const KANBAN_BACKGROUND_THEMES: KanbanBackgroundTheme[] = [
	{
		id: 'mist',
		label: 'Mist',
		description: 'Soft accent wash with the most airy contrast.',
		swatch: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent-bg) 82%, white), white)',
		boardBackground:
			`linear-gradient(180deg, color-mix(in srgb, var(--color-accent-bg) 18%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 90%, white) 100%)`,
		headerBackground:
			`linear-gradient(180deg, color-mix(in srgb, var(--color-accent-bg) 28%, white) 0%, color-mix(in srgb, var(--color-surface) 90%, white) 100%)`,
		columnBackground:
			`linear-gradient(180deg, color-mix(in srgb, var(--color-accent-bg) 14%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 88%, white) 100%)`,
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 98%, white)',
		borderTone: 'color-mix(in srgb, var(--color-text-secondary) 14%, var(--color-border))',
	},
	{
		id: 'warm',
		label: 'Warm',
		description: 'Adds a warmer paper tone without changing the board structure.',
		swatch: 'linear-gradient(135deg, color-mix(in srgb, var(--color-warm-bg) 84%, white), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-warm-bg) 38%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 90%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-warm-bg) 48%, white) 0%, color-mix(in srgb, var(--color-surface) 88%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-warm-bg) 36%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 88%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 95%, white)',
		borderTone: 'color-mix(in srgb, var(--color-warm-text) 22%, var(--color-border))',
	},
	{
		id: 'sage',
		label: 'Sage',
		description: 'A calmer green-tinted surface for planning and tracking work.',
		swatch:
			'linear-gradient(135deg, color-mix(in srgb, var(--color-success-bg) 88%, white), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-success-bg) 36%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 90%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-success-bg) 48%, white) 0%, color-mix(in srgb, var(--color-surface) 90%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-success-bg) 38%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 88%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 95%, white)',
		borderTone: 'color-mix(in srgb, var(--color-success-text) 20%, var(--color-border))',
	},
	{
		id: 'blush',
		label: 'Blush',
		description: 'A subtle rosy tint that makes alerts and high priority cards stand out.',
		swatch: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger-bg) 84%, white), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-danger-bg) 34%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 90%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-danger-bg) 44%, white) 0%, color-mix(in srgb, var(--color-surface) 89%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-danger-bg) 34%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 88%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 95%, white)',
		borderTone: 'color-mix(in srgb, var(--color-danger-border) 62%, var(--color-border))',
	},
	{
		id: 'slate',
		label: 'Canvas Blend',
		description: 'Closest to the selected canvas color, with just a light neutral board tint.',
		swatch:
			'linear-gradient(135deg, color-mix(in srgb, var(--color-surface-muted) 88%, #cbd5e1), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 78%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 90%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 88%, white) 0%, color-mix(in srgb, var(--color-surface) 88%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 84%, white) 0%, color-mix(in srgb, var(--color-surface) 88%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 97%, white)',
		borderTone: 'color-mix(in srgb, var(--color-text-secondary) 18%, var(--color-border))',
	},
];

export const KANBAN_FONT_OPTIONS: KanbanFontOption[] = [
	{ id: 'sans', label: 'Sans', family: 'var(--font-sans)' },
	{ id: 'display', label: 'Display', family: 'var(--font-display)' },
	{ id: 'mono', label: 'Mono', family: 'var(--font-mono)' },
];

export function clampKanbanFontSize(value?: number) {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return KANBAN_FONT_SIZE_RANGE.default;
	}

	return Math.min(KANBAN_FONT_SIZE_RANGE.max, Math.max(KANBAN_FONT_SIZE_RANGE.min, value));
}

export function getKanbanBackgroundTheme(themeId?: string) {
	return (
		KANBAN_BACKGROUND_THEMES.find((theme) => theme.id === themeId) ??
		KANBAN_BACKGROUND_THEMES[0]
	);
}

export function getKanbanFontOption(fontId?: string) {
	return KANBAN_FONT_OPTIONS.find((font) => font.id === fontId) ?? KANBAN_FONT_OPTIONS[0];
}

/**
 * Returns today's date as an ISO 8601 date string (YYYY-MM-DD).
 *
 * Intentionally uses the local timezone (via `Date` instance methods) rather than
 * UTC so that the result is consistent with `formatDueDate()`, which also renders
 * dates in local time by parsing the stored ISO string as midnight local time
 * (`${value}T00:00:00`). Using UTC here would cause the overdue comparison to flip
 * at a different wall-clock moment than the displayed date, creating a confusing UX.
 */
export function getTodayIso() {
	const now = new Date();
	const year = now.getFullYear();
	const month = `${now.getMonth() + 1}`.padStart(2, '0');
	const day = `${now.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatDueDate(value?: string) {
	if (!value) return '';
	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return value;

	return parsed.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	});
}

export function isKanbanCardOverdue(value?: string) {
	return Boolean(value && value < getTodayIso());
}
