export const KANBAN_ACCENT_SURFACE_SOFT = 'color-mix(in srgb, var(--color-accent-bg) 4%, white)';
export const KANBAN_ACCENT_SURFACE = 'color-mix(in srgb, var(--color-accent-bg) 8%, white)';
export const KANBAN_ACCENT_SURFACE_STRONG = 'color-mix(in srgb, var(--color-accent-bg) 12%, white)';
export const KANBAN_ACCENT_BORDER =
	'color-mix(in srgb, var(--color-accent-border) 26%, var(--color-border))';
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
		swatch: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent-bg) 72%, white), white)',
		boardBackground:
			`linear-gradient(180deg, ${KANBAN_ACCENT_SURFACE_SOFT} 0%, color-mix(in srgb, var(--color-surface-strong) 96%, white) 100%)`,
		headerBackground:
			`linear-gradient(180deg, ${KANBAN_ACCENT_SURFACE_STRONG} 0%, color-mix(in srgb, var(--color-surface) 94%, white) 100%)`,
		columnBackground:
			`linear-gradient(180deg, ${KANBAN_ACCENT_SURFACE_SOFT} 0%, color-mix(in srgb, var(--color-surface-muted) 94%, white) 100%)`,
		cardBackground: 'var(--color-surface-strong)',
		borderTone: 'var(--color-border)',
	},
	{
		id: 'warm',
		label: 'Warm',
		swatch: 'linear-gradient(135deg, color-mix(in srgb, var(--color-warm-bg) 72%, white), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-warm-bg) 28%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 94%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-warm-bg) 40%, white) 0%, color-mix(in srgb, var(--color-surface) 92%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-warm-bg) 48%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 94%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 88%, white)',
		borderTone: 'color-mix(in srgb, var(--color-warm-text) 16%, var(--color-border))',
	},
	{
		id: 'sage',
		label: 'Sage',
		swatch:
			'linear-gradient(135deg, color-mix(in srgb, var(--color-success-bg) 82%, white), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-success-bg) 28%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 94%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-success-bg) 42%, white) 0%, color-mix(in srgb, var(--color-surface) 94%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-success-bg) 50%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 94%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 90%, white)',
		borderTone: 'color-mix(in srgb, var(--color-success-text) 14%, var(--color-border))',
	},
	{
		id: 'blush',
		label: 'Blush',
		swatch: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger-bg) 78%, white), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-danger-bg) 24%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 94%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-danger-bg) 36%, white) 0%, color-mix(in srgb, var(--color-surface) 93%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-danger-bg) 46%, white) 0%, color-mix(in srgb, var(--color-surface-muted) 94%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 90%, white)',
		borderTone: 'color-mix(in srgb, var(--color-danger-border) 54%, var(--color-border))',
	},
	{
		id: 'slate',
		label: 'Slate',
		swatch:
			'linear-gradient(135deg, color-mix(in srgb, var(--color-surface-muted) 82%, #cbd5e1), white)',
		boardBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 68%, white) 0%, color-mix(in srgb, var(--color-surface-strong) 94%, white) 100%)',
		headerBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 82%, white) 0%, color-mix(in srgb, var(--color-surface) 92%, white) 100%)',
		columnBackground:
			'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 92%, white) 0%, color-mix(in srgb, var(--color-surface) 94%, white) 100%)',
		cardBackground: 'color-mix(in srgb, var(--color-surface-strong) 92%, white)',
		borderTone: 'color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-border))',
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
