import { createStarterKanbanColumns } from '@ai-canvas/shared/schemas';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
	KanbanBoardMutationOptions,
	KanbanBoardProps,
	UpdateKanbanBoard,
} from './kanban-board-types';
import {
	createKanbanCard,
	createKanbanColumn,
	normalizeKanbanBoard,
	pushKanbanHistory,
} from './kanban-utils';

interface UseKanbanMutationsOptions {
	elementId: string;
	board: KanbanOverlayCustomData;
	boardRef: React.MutableRefObject<KanbanOverlayCustomData>;
	setBoard: React.Dispatch<React.SetStateAction<KanbanOverlayCustomData>>;
	onChange: KanbanBoardProps['onChange'];
	undoStackRef: React.MutableRefObject<KanbanOverlayCustomData[]>;
	redoStackRef: React.MutableRefObject<KanbanOverlayCustomData[]>;
	boardTitleDraftRef: React.MutableRefObject<string>;
	setBoardTitleDraft: React.Dispatch<React.SetStateAction<string>>;
}

interface UseKanbanMutationsResult {
	updateBoard: UpdateKanbanBoard;
	persistBoard: (
		currentBoard: KanbanOverlayCustomData,
		nextBoard: KanbanOverlayCustomData,
		withHistory: boolean,
	) => void;
	// Destructive actions state
	pendingDeleteColumnId: string | null;
	setPendingDeleteColumnId: (value: string | null) => void;
	pendingDeleteCardId: string | null;
	setPendingDeleteCardId: (value: string | null) => void;
	pendingDeleteCardColumnId: string | null;
	setPendingDeleteCardColumnId: (value: string | null) => void;
	pendingDeleteColumn: KanbanOverlayCustomData['columns'][number] | null;
	pendingDeleteCard: KanbanOverlayCustomData['columns'][number]['cards'][number] | null;
	clearPendingDeletes: () => void;
	// Column operations
	handleColumnChange: (
		columnId: string,
		updates: Partial<KanbanOverlayCustomData['columns'][number]>,
	) => void;
	handleAddColumn: () => void;
	handleRequestDeleteColumn: (columnId: string) => void;
	handleDeletePendingColumn: () => void;
	// Card operations
	handleAddCard: (columnId: string) => void;
	handleUpdateCard: (
		columnId: string,
		cardId: string,
		updates: Partial<KanbanOverlayCustomData['columns'][number]['cards'][number]>,
	) => void;
	handleRequestDeleteCard: (columnId: string, cardId: string) => void;
	handleCancelDeleteCard: () => void;
	handleDeletePendingCard: () => void;
	handleDeleteCard: (columnId: string, cardId: string) => void;
	// Board-level operations
	handleResetBoard: () => void;
	handleSetFont: (fontId: string) => void;
	handleAdjustFontSize: (delta: number) => void;
	commitBoardTitle: () => void;
}

export function useKanbanMutations({
	elementId,
	board,
	boardRef,
	setBoard,
	onChange,
	undoStackRef,
	redoStackRef,
	boardTitleDraftRef,
	setBoardTitleDraft,
}: UseKanbanMutationsOptions): UseKanbanMutationsResult {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	// Destructive actions state
	const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
	const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null);
	const [pendingDeleteCardColumnId, setPendingDeleteCardColumnId] = useState<string | null>(null);

	// Validation that pending items still exist
	useEffect(() => {
		if (pendingDeleteColumnId) {
			const columnExists = board.columns.some((column) => column.id === pendingDeleteColumnId);
			if (!columnExists) {
				setPendingDeleteColumnId(null);
			}
		}

		if (pendingDeleteCardId && pendingDeleteCardColumnId) {
			const column = board.columns.find((c) => c.id === pendingDeleteCardColumnId);
			if (!column) {
				setPendingDeleteCardId(null);
				setPendingDeleteCardColumnId(null);
				return;
			}

			const cardExists = column.cards.some((card) => card.id === pendingDeleteCardId);
			if (!cardExists) {
				setPendingDeleteCardId(null);
				setPendingDeleteCardColumnId(null);
			}
		}
	}, [board.columns, pendingDeleteCardColumnId, pendingDeleteCardId, pendingDeleteColumnId]);

	const pendingDeleteColumn = useMemo(
		() => board.columns.find((column) => column.id === pendingDeleteColumnId) ?? null,
		[board.columns, pendingDeleteColumnId],
	);

	const pendingDeleteCard = useMemo(() => {
		if (!pendingDeleteCardId || !pendingDeleteCardColumnId) return null;
		const column = board.columns.find((c) => c.id === pendingDeleteCardColumnId);
		if (!column) return null;
		return column.cards.find((card) => card.id === pendingDeleteCardId) ?? null;
	}, [board.columns, pendingDeleteCardId, pendingDeleteCardColumnId]);

	const persistBoard = useCallback(
		(
			currentBoard: KanbanOverlayCustomData,
			nextBoard: KanbanOverlayCustomData,
			withHistory: boolean,
		) => {
			const normalized = normalizeKanbanBoard(nextBoard);
			if (withHistory) {
				undoStackRef.current = pushKanbanHistory(undoStackRef.current, currentBoard);
				redoStackRef.current = [];
			}
			boardRef.current = normalized;
			setBoard(normalized);
			onChangeRef.current(elementId, normalized);
		},
		[elementId, boardRef, setBoard, undoStackRef, redoStackRef],
	);

	const updateBoard = useCallback<UpdateKanbanBoard>(
		(updater, options?: KanbanBoardMutationOptions) => {
			const currentBoard = boardRef.current;
			const nextBoard = updater(currentBoard);
			if (nextBoard === currentBoard) return;
			persistBoard(currentBoard, nextBoard, Boolean(options?.history));
		},
		[persistBoard, boardRef],
	);

	const commitBoardTitle = useCallback(() => {
		const nextTitle = boardTitleDraftRef.current;
		if (nextTitle.trim().length === 0) {
			setBoardTitleDraft(boardRef.current.title);
			return;
		}
		if (nextTitle === boardRef.current.title) return;

		const nextBoard = normalizeKanbanBoard({
			...boardRef.current,
			title: nextTitle,
		});
		persistBoard(boardRef.current, nextBoard, true);
	}, [boardRef, boardTitleDraftRef, setBoardTitleDraft, persistBoard]);

	// Column operations
	const handleColumnChange = useCallback(
		(columnId: string, updates: Partial<KanbanOverlayCustomData['columns'][number]>) => {
			updateBoard(
				(currentBoard) => ({
					...currentBoard,
					columns: currentBoard.columns.map((candidate) =>
						candidate.id === columnId ? { ...candidate, ...updates } : candidate,
					),
				}),
				{ history: false },
			);
		},
		[updateBoard],
	);

	const handleAddColumn = useCallback(() => {
		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: [...currentBoard.columns, createKanbanColumn(currentBoard.columns.length)],
			}),
			{ history: true },
		);
	}, [updateBoard]);

	const handleRequestDeleteColumn = useCallback((columnId: string) => {
		setPendingDeleteColumnId(columnId);
	}, []);

	const handleDeletePendingColumn = useCallback(() => {
		if (!pendingDeleteColumnId) return;

		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: currentBoard.columns.filter((column) => column.id !== pendingDeleteColumnId),
			}),
			{ history: true },
		);
		setPendingDeleteColumnId(null);
	}, [pendingDeleteColumnId, updateBoard]);

	// Card operations
	const handleAddCard = useCallback(
		(columnId: string) => {
			updateBoard(
				(currentBoard) => ({
					...currentBoard,
					columns: currentBoard.columns.map((candidate) =>
						candidate.id === columnId
							? { ...candidate, cards: [...candidate.cards, createKanbanCard()] }
							: candidate,
					),
				}),
				{ history: true },
			);
		},
		[updateBoard],
	);

	const handleUpdateCard = useCallback(
		(
			columnId: string,
			cardId: string,
			updates: Partial<KanbanOverlayCustomData['columns'][number]['cards'][number]>,
		) => {
			updateBoard(
				(currentBoard) => ({
					...currentBoard,
					columns: currentBoard.columns.map((candidate) =>
						candidate.id === columnId
							? {
									...candidate,
									cards: candidate.cards.map((card) =>
										card.id === cardId ? { ...card, ...updates } : card,
									),
								}
							: candidate,
					),
				}),
				{ history: false },
			);
		},
		[updateBoard],
	);

	const handleRequestDeleteCard = useCallback((columnId: string, cardId: string) => {
		setPendingDeleteCardId(cardId);
		setPendingDeleteCardColumnId(columnId);
	}, []);

	const handleCancelDeleteCard = useCallback(() => {
		setPendingDeleteCardId(null);
		setPendingDeleteCardColumnId(null);
	}, []);

	const handleDeletePendingCard = useCallback(() => {
		if (!pendingDeleteCardId || !pendingDeleteCardColumnId) return;

		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: currentBoard.columns.map((candidate) =>
					candidate.id === pendingDeleteCardColumnId
						? {
								...candidate,
								cards: candidate.cards.filter((card) => card.id !== pendingDeleteCardId),
							}
						: candidate,
				),
			}),
			{ history: true },
		);
		setPendingDeleteCardId(null);
		setPendingDeleteCardColumnId(null);
	}, [pendingDeleteCardId, pendingDeleteCardColumnId, updateBoard]);

	const handleDeleteCard = useCallback(
		(columnId: string, cardId: string) => {
			updateBoard(
				(currentBoard) => ({
					...currentBoard,
					columns: currentBoard.columns.map((candidate) =>
						candidate.id === columnId
							? {
									...candidate,
									cards: candidate.cards.filter((card) => card.id !== cardId),
								}
							: candidate,
					),
				}),
				{ history: true },
			);
		},
		[updateBoard],
	);

	// Board-level operations
	const handleResetBoard = useCallback(() => {
		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: createStarterKanbanColumns(),
			}),
			{ history: true },
		);
	}, [updateBoard]);

	const handleSetFont = useCallback(
		(fontId: string) => {
			updateBoard((currentBoard) => ({ ...currentBoard, fontId }), { history: true });
		},
		[updateBoard],
	);

	const handleAdjustFontSize = useCallback(
		(delta: number) => {
			updateBoard(
				(currentBoard) => ({
					...currentBoard,
					fontSize: (currentBoard.fontSize ?? 14) + delta,
				}),
				{ history: true },
			);
		},
		[updateBoard],
	);

	const clearPendingDeletes = useCallback(() => {
		setPendingDeleteColumnId(null);
		setPendingDeleteCardId(null);
		setPendingDeleteCardColumnId(null);
	}, []);

	return {
		updateBoard,
		persistBoard,
		// Destructive actions state
		pendingDeleteColumnId,
		setPendingDeleteColumnId,
		pendingDeleteCardId,
		setPendingDeleteCardId,
		pendingDeleteCardColumnId,
		setPendingDeleteCardColumnId,
		pendingDeleteColumn,
		pendingDeleteCard,
		clearPendingDeletes,
		// Column operations
		handleColumnChange,
		handleAddColumn,
		handleRequestDeleteColumn,
		handleDeletePendingColumn,
		// Card operations
		handleAddCard,
		handleUpdateCard,
		handleRequestDeleteCard,
		handleCancelDeleteCard,
		handleDeletePendingCard,
		handleDeleteCard,
		// Board-level operations
		handleResetBoard,
		handleSetFont,
		handleAdjustFontSize,
		commitBoardTitle,
	};
}
