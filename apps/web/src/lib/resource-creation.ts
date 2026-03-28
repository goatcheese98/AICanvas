import type { ResourceCreationType } from '@/components/shell/useNewResourceCreation';

/**
 * Metadata for each resource type shown in the creation menu
 */
export interface ResourceTypeMetadata {
	id: ResourceCreationType;
	label: string;
	description: string;
	icon: ResourceIconType;
	category: 'heavy' | 'canvas-native' | 'navigation';
	shortcut?: string;
}

export type ResourceIconType =
	| 'canvas'
	| 'board'
	| 'prototype'
	| 'document'
	| 'quick-note'
	| 'web-embed';

/**
 * All available resource creation options with their metadata
 */
export const RESOURCE_TYPE_METADATA: ResourceTypeMetadata[] = [
	{
		id: 'canvas',
		label: 'New Canvas',
		description: 'Create a new canvas workspace',
		icon: 'canvas',
		category: 'navigation',
		shortcut: 'C',
	},
	{
		id: 'board',
		label: 'New Board',
		description: 'Create a Kanban board for task management',
		icon: 'board',
		category: 'heavy',
		shortcut: 'B',
	},
	{
		id: 'prototype',
		label: 'New Prototype',
		description: 'Create a React prototype playground',
		icon: 'prototype',
		category: 'heavy',
		shortcut: 'P',
	},
	{
		id: 'document',
		label: 'New Document',
		description: 'Create a rich text document',
		icon: 'document',
		category: 'heavy',
		shortcut: 'D',
	},
	{
		id: 'quick-note',
		label: 'Quick Note',
		description: 'Add a markdown note to the current canvas',
		icon: 'quick-note',
		category: 'canvas-native',
		shortcut: 'N',
	},
	{
		id: 'web-embed',
		label: 'Web Embed',
		description: 'Embed a website or media on the canvas',
		icon: 'web-embed',
		category: 'canvas-native',
		shortcut: 'E',
	},
];

/**
 * Group resource types by their category
 */
export const RESOURCE_CATEGORIES = {
	heavy: RESOURCE_TYPE_METADATA.filter((r) => r.category === 'heavy'),
	canvasNative: RESOURCE_TYPE_METADATA.filter((r) => r.category === 'canvas-native'),
	navigation: RESOURCE_TYPE_METADATA.filter((r) => r.category === 'navigation'),
} as const;

/**
 * Check if a resource type is a "heavy" resource that requires focused view
 */
export function isHeavyResource(type: ResourceCreationType): boolean {
	const metadata = RESOURCE_TYPE_METADATA.find((r) => r.id === type);
	return metadata?.category === 'heavy';
}

/**
 * Check if a resource type is canvas-native (inserts directly on canvas)
 */
export function isCanvasNativeResource(type: ResourceCreationType): boolean {
	const metadata = RESOURCE_TYPE_METADATA.find((r) => r.id === type);
	return metadata?.category === 'canvas-native';
}

/**
 * Check if a resource type requires navigation (like canvas creation)
 */
export function isNavigationResource(type: ResourceCreationType): boolean {
	const metadata = RESOURCE_TYPE_METADATA.find((r) => r.id === type);
	return metadata?.category === 'navigation';
}

/**
 * Get the display label for a resource type
 */
export function getResourceLabel(type: ResourceCreationType): string {
	return RESOURCE_TYPE_METADATA.find((r) => r.id === type)?.label ?? type;
}

/**
 * Get the keyboard shortcut for a resource type
 */
export function getResourceShortcut(type: ResourceCreationType): string | undefined {
	return RESOURCE_TYPE_METADATA.find((r) => r.id === type)?.shortcut;
}

/**
 * Format a resource creation success message
 */
export function formatResourceSuccessMessage(type: ResourceCreationType): string {
	const labels: Record<ResourceCreationType, string> = {
		canvas: 'Canvas created',
		board: 'Board created and opened',
		document: 'Document created and opened',
		prototype: 'Prototype created and opened',
		'quick-note': 'Quick note added to canvas',
		'web-embed': 'Web embed added to canvas',
	};
	return labels[type] ?? 'Resource created';
}

/**
 * Validate that a string is a valid ResourceCreationType
 */
export function isValidResourceType(type: unknown): type is ResourceCreationType {
	if (typeof type !== 'string') return false;
	return RESOURCE_TYPE_METADATA.some((r) => r.id === type);
}

/**
 * Parse a keyboard event to check if it matches a resource creation shortcut
 * Returns the matched resource type or null
 */
export function parseResourceKeyboardShortcut(event: KeyboardEvent): ResourceCreationType | null {
	// Only match if Alt/Option is pressed (not Ctrl/Cmd)
	if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
		return null;
	}

	const key = event.key.toUpperCase();
	const match = RESOURCE_TYPE_METADATA.find((r) => r.shortcut?.toUpperCase() === key);
	return match?.id ?? null;
}
