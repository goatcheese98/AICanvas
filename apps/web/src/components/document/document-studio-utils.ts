import { createOverlayElementDraft } from '@/components/canvas/element-factories';
import { normalizeNewLexOverlay } from '@ai-canvas/shared/schemas';
import type { HeavyResourceRecord, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
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

export function mergeDocumentStudioElements(
	elements: readonly ExcalidrawElement[],
	documentId: string,
	documentRecord: HeavyResourceRecord | null,
) {
	if (!documentRecord) {
		return elements;
	}

	const normalizedDocument = normalizeNewLexOverlay(documentRecord.data as NewLexOverlayCustomData);
	let foundDocument = false;

	const mergedElements = elements.map((element) => {
		if (element.id !== documentId) {
			return element;
		}

		foundDocument = true;
		return {
			...element,
			customData: normalizedDocument,
		};
	});

	if (foundDocument) {
		return mergedElements;
	}

	return [
		...mergedElements,
		{
			...createOverlayElementDraft(
				'newlex',
				{ x: 480, y: 360 },
				{
					title: normalizedDocument.title,
				},
			),
			id: documentId,
			customData: normalizedDocument,
		} as unknown as ExcalidrawElement,
	];
}
