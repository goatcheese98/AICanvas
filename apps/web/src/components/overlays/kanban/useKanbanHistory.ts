import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useCallback, useRef, useState } from 'react';
import { cloneKanbanBoard, pushKanbanHistory } from './kanban-utils';

interface UseKanbanHistoryOptions {
	elementId: string;
	boardRef: React.MutableRefObject<KanbanOverlayCustomData>;
	setBoard: React.Dispatch<React.SetStateAction<KanbanOverlayCustomData>>;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
}

interface UseKanbanHistoryResult {
	undoStackRef: React.MutableRefObject<KanbanOverlayCustomData[]>;
	redoStackRef: React.MutableRefObject<KanbanOverlayCustomData[]>;
	handleUndo: () => void;
	handleRedo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	clearStacks: () => void;
}

export function useKanbanHistory({
	elementId,
	boardRef,
	setBoard,
	onChange,
}: UseKanbanHistoryOptions): UseKanbanHistoryResult {
	const undoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const redoStackRef = useRef<KanbanOverlayCustomData[]>([]);

	// Use a counter to force re-renders when stacks change (for canUndo/canRedo)
	const [_stackVersion, setStackVersion] = useState(0);

	const bumpVersion = useCallback(() => {
		setStackVersion((v) => v + 1);
	}, []);

	const handleUndo = useCallback(() => {
		const previous = undoStackRef.current.at(-1);
		if (!previous) return;

		const currentBoard = boardRef.current;
		undoStackRef.current = undoStackRef.current.slice(0, -1);
		redoStackRef.current = pushKanbanHistory(redoStackRef.current, currentBoard);

		const nextBoard = cloneKanbanBoard(previous);
		boardRef.current = nextBoard;
		setBoard(nextBoard);
		onChange(elementId, nextBoard);
		bumpVersion();
	}, [elementId, boardRef, setBoard, onChange, bumpVersion]);

	const handleRedo = useCallback(() => {
		const nextFromRedo = redoStackRef.current.at(-1);
		if (!nextFromRedo) return;

		const currentBoard = boardRef.current;
		redoStackRef.current = redoStackRef.current.slice(0, -1);
		undoStackRef.current = pushKanbanHistory(undoStackRef.current, currentBoard);

		const nextBoard = cloneKanbanBoard(nextFromRedo);
		boardRef.current = nextBoard;
		setBoard(nextBoard);
		onChange(elementId, nextBoard);
		bumpVersion();
	}, [elementId, boardRef, setBoard, onChange, bumpVersion]);

	const clearStacks = useCallback(() => {
		undoStackRef.current = [];
		redoStackRef.current = [];
		bumpVersion();
	}, [bumpVersion]);

	const canUndo = undoStackRef.current.length > 0;
	const canRedo = redoStackRef.current.length > 0;

	return {
		undoStackRef,
		redoStackRef,
		handleUndo,
		handleRedo,
		canUndo,
		canRedo,
		clearStacks,
	};
}
