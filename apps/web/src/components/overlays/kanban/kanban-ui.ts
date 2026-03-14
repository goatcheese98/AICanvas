import type { CSSProperties } from 'react';

export const KANBAN_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export const KANBAN_ICON_BUTTON =
	'inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export const KANBAN_BUTTON_SURFACE_STYLE: CSSProperties = {
	borderColor: 'var(--color-border)',
	backgroundColor: 'var(--color-surface-strong)',
	backgroundImage: 'var(--kanban-sketch-control-texture)',
	color: 'var(--color-text-secondary)',
	boxShadow: 'var(--kanban-sketch-control-shadow)',
};

export function getKanbanPanelStyle(active = false): CSSProperties {
	if (!active) {
		return KANBAN_BUTTON_SURFACE_STYLE;
	}

	return {
		...KANBAN_BUTTON_SURFACE_STYLE,
		borderColor: 'color-mix(in srgb, var(--color-accent-border) 34%, var(--color-border))',
		backgroundColor: 'color-mix(in srgb, var(--color-accent-bg) 16%, white)',
		color: 'color-mix(in srgb, var(--color-accent-text) 24%, var(--color-text-secondary))',
	};
}
