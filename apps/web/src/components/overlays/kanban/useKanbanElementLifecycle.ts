import { useCallback, useEffect, useRef } from 'react';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { normalizeKanbanBoard } from './kanban-utils';

interface UseKanbanElementLifecycleOptions {
	element: { id: string };
	isSelected: boolean;
	boardRef: React.MutableRefObject<KanbanOverlayCustomData>;
	boardTitleDraftRef: React.MutableRefObject<string>;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
	clearPendingDeletes: () => void;
	clearStacks: () => void;
}

interface UseKanbanElementLifecycleResult {
	elementId: string;
	handleElementChange: () => void;
}

export function useKanbanElementLifecycle({
	element,
	isSelected,
	boardRef,
	boardTitleDraftRef,
	onChange,
	setShowSettings,
	clearPendingDeletes,
	clearStacks,
}: UseKanbanElementLifecycleOptions): UseKanbanElementLifecycleResult {
	const elementIdRef = useRef(element.id);
	const onChangeRef = useRef(onChange);
	const lastIsSelectedForCleanupRef = useRef(isSelected);

	// Update refs on each render
	onChangeRef.current = onChange;

	// Element ID change detection - clear history stacks on ID change
	useEffect(() => {
		if (elementIdRef.current === element.id) {
			return;
		}

		// Element ID changed - clear state tied to previous element
		elementIdRef.current = element.id;
		clearStacks();
		clearPendingDeletes();
	}, [element.id, clearStacks, clearPendingDeletes]);

	// Deselect handling - clear UI state and flush draft
	useEffect(() => {
		if (lastIsSelectedForCleanupRef.current && !isSelected) {
			// Flush draft on deselect
			const nextTitle = boardTitleDraftRef.current;
			if (nextTitle.trim().length > 0 && nextTitle !== boardRef.current.title) {
				const nextBoard = normalizeKanbanBoard({
					...boardRef.current,
					title: nextTitle,
				});
				boardRef.current = nextBoard;
				onChangeRef.current(element.id, nextBoard);
			}

			// Clear UI state
			setShowSettings(false);
			clearPendingDeletes();
		}
		lastIsSelectedForCleanupRef.current = isSelected;
	}, [isSelected, element.id, boardRef, boardTitleDraftRef, setShowSettings, clearPendingDeletes]);

	const handleElementChange = useCallback(() => {
		// Manual trigger for element change handling if needed
		if (elementIdRef.current !== element.id) {
			elementIdRef.current = element.id;
			clearStacks();
			clearPendingDeletes();
		}
	}, [element.id, clearStacks, clearPendingDeletes]);

	return { elementId: element.id, handleElementChange };
}
