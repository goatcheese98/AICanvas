import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export function getBoardStudioPath(canvasId: string, boardId: string) {
	return `/canvas/${canvasId}/board/${boardId}`;
}

function isOpenBoardElement(
	element: ExcalidrawElement,
): element is ExcalidrawElement & { customData: KanbanOverlayCustomData } {
	return (
		!element.isDeleted && (element.customData as { type?: unknown } | undefined)?.type === 'kanban'
	);
}

export function getOpenBoardElements(elements: readonly ExcalidrawElement[]) {
	return elements.filter(isOpenBoardElement);
}
