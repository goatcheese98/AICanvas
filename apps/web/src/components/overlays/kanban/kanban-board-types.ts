import type { KanbanCard, KanbanColumn, KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type KanbanElement = ExcalidrawElement & {
	customData: KanbanOverlayCustomData;
};

export interface KanbanBoardProps {
	element: KanbanElement;
	mode: 'preview' | 'shell' | 'live';
	isSelected: boolean;
	isActive: boolean;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	onActivityChange?: (isActive: boolean) => void;
	/** Called when user requests to open the board in focused view (preview mode only) */
	onOpenBoard?: () => void;
}

export interface KanbanBoardMutationOptions {
	history?: boolean;
}

export type UpdateKanbanBoard = (
	updater: (currentBoard: KanbanOverlayCustomData) => KanbanOverlayCustomData,
	options?: KanbanBoardMutationOptions,
) => void;

export type KanbanColumnUpdater = (columnId: string, updates: Partial<KanbanColumn>) => void;
export type KanbanCardUpdater = (
	columnId: string,
	cardId: string,
	updates: Partial<KanbanCard>,
) => void;
