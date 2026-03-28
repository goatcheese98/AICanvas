import type { OverlayType } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/**
 * Heavy resource types that should trigger contextual details panel opening.
 * These resources have complex state and benefit from the details panel.
 */
export const HEAVY_RESOURCE_TYPES: readonly OverlayType[] = ['kanban', 'newlex', 'prototype'] as const;

/**
 * Type guard to check if a value is a valid heavy resource type.
 */
export function isHeavyResourceType(type: unknown): type is (typeof HEAVY_RESOURCE_TYPES)[number] {
	return typeof type === 'string' && (HEAVY_RESOURCE_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an Excalidraw element is a "heavy resource" that should open
 * the details panel when selected.
 *
 * Heavy resources are: kanban boards, lexical documents (newlex), and prototypes.
 *
 * @param element - The Excalidraw element to check
 * @returns true if the element is a heavy resource
 *
 * @example
 * ```ts
 * const element = excalidrawApi.getSceneElements()[0];
 * if (isHeavyResource(element)) {
 *   openRightPanel('details');
 * }
 * ```
 */
export function isHeavyResource(element: ExcalidrawElement | null | undefined): boolean {
	if (!element) return false;

	const customData = element.customData as { type?: unknown } | undefined;
	return isHeavyResourceType(customData?.type);
}

/**
 * Extract the resource type from an Excalidraw element.
 *
 * @param element - The Excalidraw element
 * @returns The overlay type, or null if not a recognized resource
 */
export function getResourceType(
	element: ExcalidrawElement | null | undefined,
): OverlayType | null {
	if (!element) return null;

	const customData = element.customData as { type?: unknown } | undefined;
	const type = customData?.type;

	if (
		type === 'kanban' ||
		type === 'newlex' ||
		type === 'markdown' ||
		type === 'web-embed' ||
		type === 'prototype'
	) {
		return type as OverlayType;
	}

	return null;
}

/**
 * Get metadata about a resource element.
 * Returns information that can be displayed in the details panel.
 *
 * @param element - The Excalidraw element
 * @returns Metadata object with resource information
 */
export function getResourceMetadata(element: ExcalidrawElement | null | undefined): {
	type: OverlayType | null;
	isHeavy: boolean;
	title: string;
	elementId: string | null;
} {
	if (!element) {
		return {
			type: null,
			isHeavy: false,
			title: '',
			elementId: null,
		};
	}

	const type = getResourceType(element);
	const customData = element.customData as { title?: string } | undefined;

	// Determine default title based on type
	let defaultTitle = 'Untitled';
	switch (type) {
		case 'kanban':
			defaultTitle = 'Untitled Board';
			break;
		case 'newlex':
			defaultTitle = 'Untitled Document';
			break;
		case 'markdown':
			defaultTitle = 'Untitled Note';
			break;
		case 'web-embed':
			defaultTitle = 'Web Embed';
			break;
		case 'prototype':
			defaultTitle = 'Untitled Prototype';
			break;
	}

	return {
		type,
		isHeavy: isHeavyResource(element),
		title: customData?.title ?? defaultTitle,
		elementId: element.id,
	};
}
