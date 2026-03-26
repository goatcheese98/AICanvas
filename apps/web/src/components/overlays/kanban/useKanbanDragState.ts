import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useCallback, useReducer, useRef } from 'react';
import type { DragEvent, MutableRefObject } from 'react';
import type { UpdateKanbanBoard } from './kanban-board-types';
import {
	getProjectedOverCardId,
	getProjectedOverColumnId,
	moveKanbanCard,
	moveKanbanColumn,
} from './kanban-utils';

export type DragState =
	| { mode: 'idle' }
	| {
			mode: 'card';
			cardId: string;
			fromColumnId: string;
			overColumnId: string | null;
			overCardId: string | null;
			isDeleteTargeted: boolean;
	  }
	| { mode: 'column'; columnId: string; projectedDropId: string | null };

type DragAction =
	| {
			type: 'CARD_START';
			cardId: string;
			fromColumnId: string;
	  }
	| {
			type: 'CARD_OVER';
			overColumnId: string;
			overCardId: string | null;
	  }
	| { type: 'CARD_DELETE_TARGET' }
	| { type: 'COLUMN_START'; columnId: string }
	| { type: 'COLUMN_OVER'; projectedDropId: string | null }
	| { type: 'CLEAR' };

export function dragReducer(state: DragState, action: DragAction): DragState {
	switch (action.type) {
		case 'CARD_START':
			return {
				mode: 'card',
				cardId: action.cardId,
				fromColumnId: action.fromColumnId,
				overColumnId: action.fromColumnId,
				overCardId: action.cardId,
				isDeleteTargeted: false,
			};
		case 'CARD_OVER':
			if (state.mode !== 'card') return state;
			return {
				...state,
				overColumnId: action.overColumnId,
				overCardId: action.overCardId,
				isDeleteTargeted: false,
			};
		case 'CARD_DELETE_TARGET':
			if (state.mode !== 'card') return state;
			return { ...state, overColumnId: null, overCardId: null, isDeleteTargeted: true };
		case 'COLUMN_START':
			return {
				mode: 'column',
				columnId: action.columnId,
				projectedDropId: action.columnId,
			};
		case 'COLUMN_OVER':
			if (state.mode !== 'column') return state;
			return { ...state, projectedDropId: action.projectedDropId };
		case 'CLEAR':
			return { mode: 'idle' };
		default:
			return state;
	}
}

interface UseKanbanDragStateArgs {
	boardRef: MutableRefObject<KanbanOverlayCustomData>;
	updateBoard: UpdateKanbanBoard;
}

export function useKanbanDragState({ boardRef, updateBoard }: UseKanbanDragStateArgs) {
	const [dragState, dispatchDragState] = useReducer(dragReducer, { mode: 'idle' } as DragState);
	const dragStateRef = useRef<DragState>({ mode: 'idle' });

	const dispatchDrag = useCallback((action: DragAction) => {
		dragStateRef.current = dragReducer(dragStateRef.current, action);
		dispatchDragState(action);
	}, []);

	const clearDragState = useCallback(() => {
		dispatchDrag({ type: 'CLEAR' });
	}, [dispatchDrag]);

	const handleCardDragStart = useCallback(
		(event: DragEvent<HTMLElement>, cardId: string, columnId: string) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', '_');
			event.dataTransfer.setData('application/x-ai-canvas-kanban-card', cardId);
			event.dataTransfer.setDragImage(event.currentTarget, 12, 12);
			dispatchDrag({ type: 'CARD_START', cardId, fromColumnId: columnId });
		},
		[dispatchDrag],
	);

	const handleCardColumnDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>, columnId: string) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			dispatchDrag({ type: 'CARD_OVER', overColumnId: columnId, overCardId: null });
		},
		[dispatchDrag],
	);

	const handleCardColumnDrop = useCallback(
		(event: DragEvent<HTMLDivElement>, columnId: string) => {
			event.preventDefault();
			if (dragStateRef.current.mode !== 'card') {
				clearDragState();
				return;
			}

			const { cardId, overColumnId, overCardId } = dragStateRef.current;
			const targetCardId = overColumnId === columnId ? overCardId : null;
			updateBoard((currentBoard) => moveKanbanCard(currentBoard, cardId, columnId, targetCardId), {
				history: true,
			});
			clearDragState();
		},
		[clearDragState, updateBoard],
	);

	const handleCardDragOverTarget = useCallback(
		(event: DragEvent<HTMLDivElement>, columnId: string, hoveredCardId: string) => {
			event.preventDefault();
			event.stopPropagation();
			event.dataTransfer.dropEffect = 'move';
			const rect = event.currentTarget.getBoundingClientRect();
			const pointerRatioWithinCard =
				rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
			const isPastMidpoint = pointerRatioWithinCard > 0.5;
			const previousProjectedCardId =
				dragStateRef.current.mode === 'card' && dragStateRef.current.overColumnId === columnId
					? dragStateRef.current.overCardId
					: null;
			dispatchDrag({
				type: 'CARD_OVER',
				overColumnId: columnId,
				overCardId: getProjectedOverCardId(
					boardRef.current.columns.find((column) => column.id === columnId)?.cards ?? [],
					hoveredCardId,
					isPastMidpoint,
					previousProjectedCardId,
					pointerRatioWithinCard,
				),
			});
		},
		[boardRef, dispatchDrag],
	);

	const handleColumnDragStart = useCallback(
		(event: DragEvent<HTMLElement>, columnId: string) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', columnId);
			dispatchDrag({ type: 'COLUMN_START', columnId });
		},
		[dispatchDrag],
	);

	const handleColumnReorderDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>, hoveredColumnId: string) => {
			event.preventDefault();
			if (dragStateRef.current.mode !== 'column') return;
			event.dataTransfer.dropEffect = 'move';
			const rect = event.currentTarget.getBoundingClientRect();
			const isPastMidpoint = event.clientX > rect.left + rect.width / 2;
			dispatchDrag({
				type: 'COLUMN_OVER',
				projectedDropId: getProjectedOverColumnId(
					boardRef.current.columns,
					hoveredColumnId,
					isPastMidpoint,
				),
			});
		},
		[boardRef, dispatchDrag],
	);

	const handleColumnReorderDrop = useCallback(
		(event: DragEvent<HTMLElement>) => {
			event.preventDefault();
			if (dragStateRef.current.mode !== 'column') {
				clearDragState();
				return;
			}

			const { columnId, projectedDropId } = dragStateRef.current;
			updateBoard((currentBoard) => moveKanbanColumn(currentBoard, columnId, projectedDropId), {
				history: true,
			});
			clearDragState();
		},
		[clearDragState, updateBoard],
	);

	const handleDeleteDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			if (dragStateRef.current.mode !== 'card') {
				clearDragState();
				return;
			}

			const { cardId } = dragStateRef.current;
			updateBoard(
				(currentBoard) => ({
					...currentBoard,
					columns: currentBoard.columns.map((column) => ({
						...column,
						cards: column.cards.filter((card) => card.id !== cardId),
					})),
				}),
				{ history: true },
			);
			clearDragState();
		},
		[clearDragState, updateBoard],
	);

	const handleDeleteDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		dispatchDrag({ type: 'CARD_DELETE_TARGET' });
	}, []);

	const handleColumnDropAtEnd = useCallback(
		(event: DragEvent<HTMLElement>) => {
			event.preventDefault();
			if (dragStateRef.current.mode !== 'column') return;
			dispatchDrag({ type: 'COLUMN_OVER', projectedDropId: null });
		},
		[dispatchDrag],
	);

	return {
		dragState,
		clearDragState,
		handleCardDragStart,
		handleCardColumnDragOver,
		handleCardColumnDrop,
		handleCardDragOverTarget,
		handleColumnDragStart,
		handleColumnReorderDragOver,
		handleColumnReorderDrop,
		handleColumnDropAtEnd,
		handleDeleteDragOver,
		handleDeleteDrop,
		draggingCardId: dragState.mode === 'card' ? dragState.cardId : null,
		draggingFromColumnId: dragState.mode === 'card' ? dragState.fromColumnId : null,
		cardOverColumnId: dragState.mode === 'card' ? dragState.overColumnId : null,
		overCardId: dragState.mode === 'card' ? dragState.overCardId : null,
		draggingColumnId: dragState.mode === 'column' ? dragState.columnId : null,
		projectedColumnDropId: dragState.mode === 'column' ? dragState.projectedDropId : null,
		isDeleteTargeted: dragState.mode === 'card' ? dragState.isDeleteTargeted : false,
	};
}
