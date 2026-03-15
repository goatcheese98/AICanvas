import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { KanbanCard, KanbanColumn, KanbanOverlayCustomData } from '@ai-canvas/shared/types';

export type KanbanElement = ExcalidrawElement & {
	customData: KanbanOverlayCustomData;
};

export interface KanbanBoardProps {
	element: KanbanElement;
	mode?: 'preview' | 'live';
	isSelected: boolean;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	onEditingChange?: (isEditing: boolean) => void;
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
