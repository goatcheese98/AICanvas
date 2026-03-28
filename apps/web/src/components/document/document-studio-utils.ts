import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export function getDocumentStudioPath(canvasId: string, documentId: string) {
	return `/canvas/${canvasId}/document/${documentId}`;
}

function isOpenDocumentElement(
	element: ExcalidrawElement,
): element is ExcalidrawElement & { customData: NewLexOverlayCustomData } {
	return (
		!element.isDeleted && (element.customData as { type?: unknown } | undefined)?.type === 'newlex'
	);
}

export function getOpenDocumentElements(elements: readonly ExcalidrawElement[]) {
	return elements.filter(isOpenDocumentElement);
}
