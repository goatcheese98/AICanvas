import type { OverlayType } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	type OverlayUpdatePayloadMap,
	type TypedOverlayCanvasElement,
	getOverlayDefinition,
	isOverlayType,
} from './overlay-definitions';

export function collectOverlayElements(
	elements: readonly ExcalidrawElement[],
): TypedOverlayCanvasElement[] {
	return elements.filter(isOverlayElement) as unknown as TypedOverlayCanvasElement[];
}

function isOverlayElement(el: ExcalidrawElement): boolean {
	if (el.isDeleted) return false;
	return isOverlayType((el.customData as { type?: unknown } | undefined)?.type);
}

export function applyOverlayUpdateByType<K extends OverlayType>(
	type: K,
	element: TypedOverlayCanvasElement,
	payload: OverlayUpdatePayloadMap[K],
): TypedOverlayCanvasElement {
	return getOverlayDefinition(type).applyUpdate(
		element as never,
		payload as never,
	) as TypedOverlayCanvasElement;
}

export function applyOverlayUpdateToScene<K extends OverlayType>(
	elements: readonly ExcalidrawElement[],
	elementId: string,
	type: K,
	payload: OverlayUpdatePayloadMap[K],
) {
	let didChange = false;
	const nextElements = elements.map((candidate) => {
		if (candidate.id !== elementId) return candidate;
		const updated = applyOverlayUpdateByType(
			type,
			candidate as unknown as TypedOverlayCanvasElement,
			payload,
		);
		didChange = didChange || updated !== candidate;
		return updated;
	});

	return {
		didChange,
		nextElements,
	};
}

/**
 * Z-index calculation for overlay stacking.
 * Port of the reference codebase's getOverlayZIndex.
 */
export function getOverlayZIndex(
	isSelected: boolean,
	isEditing: boolean,
	stackIndex: number,
): number {
	let z = stackIndex * 10;
	if (isSelected) z += 10_000;
	if (isEditing) z += 10_000;
	return z;
}
