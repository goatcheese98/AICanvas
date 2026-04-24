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
}

export interface KanbanBoardMutationOptions {
	history?: boolean;
}

export type UpdateKanbanBoard = (
	updater: (currentBoard: KanbanOverlayCustomData) => KanbanOverlayCustomData,
	options?: KanbanBoardMutationOptions,
) => void;

type KanbanColumnUpdater = (columnId: string, updates: Partial<KanbanColumn>) => void;
type KanbanCardUpdater = (
	columnId: string,
	cardId: string,
	updates: Partial<KanbanCard>,
) => void;
