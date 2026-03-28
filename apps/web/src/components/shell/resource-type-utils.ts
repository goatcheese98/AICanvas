import type { OverlayType } from '@ai-canvas/shared/types';

/**
 * Heavy resource types that open Details panel on single-click.
 * These are complex resources with rich metadata and actions.
 */
export const HEAVY_OVERLAY_TYPES: readonly OverlayType[] = ['kanban', 'newlex', 'prototype'] as const;

/**
 * Lightweight resource types that do NOT open Details panel on selection.
 * These are simple resources that can be edited inline.
 */
export const LIGHT_OVERLAY_TYPES: readonly OverlayType[] = ['markdown', 'web-embed'] as const;

/**
 * Check if an overlay type is a "heavy" resource that should open Details panel.
 */
export function isHeavyOverlayType(type: unknown): type is (typeof HEAVY_OVERLAY_TYPES)[number] {
	return typeof type === 'string' && (HEAVY_OVERLAY_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an overlay type is a "light" resource that should NOT open Details panel.
 */
export function isLightOverlayType(type: unknown): type is (typeof LIGHT_OVERLAY_TYPES)[number] {
	return typeof type === 'string' && (LIGHT_OVERLAY_TYPES as readonly string[]).includes(type);
}

/**
 * Get the display label for an overlay type.
 */
export function getOverlayTypeLabel(type: OverlayType): string {
	const labels: Record<OverlayType, string> = {
		kanban: 'Kanban Board',
		newlex: 'Document',
		markdown: 'Note',
		'web-embed': 'Web Embed',
		prototype: 'Prototype',
	};
	return labels[type] ?? 'Unknown';
}

/**
 * Get the icon component name for an overlay type.
 * Used for dynamic icon rendering.
 */
export function getOverlayTypeIconName(type: OverlayType): string {
	const icons: Record<OverlayType, string> = {
		kanban: 'KanbanIcon',
		newlex: 'DocumentIcon',
		markdown: 'NoteIcon',
		'web-embed': 'GlobeIcon',
		prototype: 'CodeIcon',
	};
	return icons[type] ?? 'FileIcon';
}
