import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import {
	cloneKanbanBoard,
	createKanbanCard,
	createKanbanColumn,
	createStarterKanbanColumns,
	normalizeKanbanBoard,
	pushKanbanHistory,
	serializeKanbanBoard,
} from './kanban-utils';
import type { KanbanBoardProps, UpdateKanbanBoard } from './kanban-board-types';

interface UseKanbanBoardStateResult {
	board: KanbanOverlayCustomData;
	boardRef: MutableRefObject<KanbanOverlayCustomData>;
	boardTitleDraft: string;
	showSettings: boolean;
	pendingDeleteColumnId: string | null;
	pendingDeleteColumn: KanbanOverlayCustomData['columns'][number] | null;
	searchQuery: string;
	searchFocused: boolean;
	isLiveResizing: boolean;
	canUndo: boolean;
	canRedo: boolean;
	setBoardTitleDraft: Dispatch<SetStateAction<string>>;
	setShowSettings: Dispatch<SetStateAction<boolean>>;
	setPendingDeleteColumnId: Dispatch<SetStateAction<string | null>>;
	setSearchQuery: Dispatch<SetStateAction<string>>;
	setSearchFocused: Dispatch<SetStateAction<boolean>>;
	updateBoard: UpdateKanbanBoard;
	handleUndo: () => void;
	handleRedo: () => void;
	commitBoardTitle: () => void;
	handleColumnChange: (columnId: string, updates: Partial<KanbanOverlayCustomData['columns'][number]>) => void;
	handleRequestDeleteColumn: (columnId: string) => void;
	handleAddCard: (columnId: string) => void;
	handleUpdateCard: (
		columnId: string,
		cardId: string,
		updates: Partial<KanbanOverlayCustomData['columns'][number]['cards'][number]>,
	) => void;
	handleDeleteCard: (columnId: string, cardId: string) => void;
	handleDeletePendingColumn: () => void;
	handleAddColumn: () => void;
	handleResetBoard: () => void;
	handleSetFont: (fontId: string) => void;
	handleAdjustFontSize: (delta: number) => void;
	dismissPanels: () => void;
	handleEscapeKey: () => void;
}

export function useKanbanBoardState({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: KanbanBoardProps): UseKanbanBoardStateResult {
	const normalizedInitialBoard = useMemo(() => normalizeKanbanBoard(element.customData), [element.customData]);
	const [board, setBoard] = useState<KanbanOverlayCustomData>(normalizedInitialBoard);
	const [boardTitleDraft, setBoardTitleDraft] = useState(normalizedInitialBoard.title);
	const [showSettings, setShowSettings] = useState(false);
	const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchFocused, setSearchFocused] = useState(false);
	const [isLiveResizing, setIsLiveResizing] = useState(false);
	const undoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const redoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const boardRef = useRef(board);
	const onChangeRef = useRef(onChange);
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const hasReportedEditingRef = useRef(false);
	const externalBoardSignatureRef = useRef(serializeKanbanBoard(normalizedInitialBoard));
	const resizeSettleTimeoutRef = useRef<number | null>(null);
	const previousSizeRef = useRef({ width: element.width, height: element.height });

	useEffect(() => {
		boardRef.current = board;
	}, [board]);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		setBoardTitleDraft(board.title);
	}, [board.title]);

	useEffect(() => {
		const normalized = normalizeKanbanBoard(element.customData);
		const nextSignature = serializeKanbanBoard(normalized);
		if (nextSignature === externalBoardSignatureRef.current) return;
		externalBoardSignatureRef.current = nextSignature;
		boardRef.current = normalized;
		setBoard((current) => (serializeKanbanBoard(current) === nextSignature ? current : normalized));
		setBoardTitleDraft((current) => (current === normalized.title ? current : normalized.title));
	}, [element.customData]);

	useEffect(() => {
		undoStackRef.current = [];
		redoStackRef.current = [];
	}, [element.id]);

	useEffect(() => {
		const width = element.width;
		const height = element.height;
		const previousSize = previousSizeRef.current;
		const sizeChanged = previousSize.width !== width || previousSize.height !== height;
		previousSizeRef.current = { width, height };

		if (!sizeChanged || !isSelected) {
			return;
		}

		setIsLiveResizing(true);
		if (resizeSettleTimeoutRef.current !== null) {
			window.clearTimeout(resizeSettleTimeoutRef.current);
		}
		resizeSettleTimeoutRef.current = window.setTimeout(() => {
			setIsLiveResizing(false);
			resizeSettleTimeoutRef.current = null;
		}, 140);
	}, [element.height, element.width, isSelected]);

	useEffect(() => {
		if (!hasReportedEditingRef.current && !isSelected) {
			hasReportedEditingRef.current = true;
			lastReportedEditingRef.current = false;
			return;
		}
		if (lastReportedEditingRef.current === isSelected) return;
		hasReportedEditingRef.current = true;
		lastReportedEditingRef.current = isSelected;
		onEditingChangeRef.current?.(isSelected);
	}, [isSelected]);

	useEffect(
		() => () => {
			if (resizeSettleTimeoutRef.current !== null) {
				window.clearTimeout(resizeSettleTimeoutRef.current);
			}
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[],
	);

	useEffect(() => {
		if (isSelected) return;
		setShowSettings(false);
		setPendingDeleteColumnId(null);
	}, [isSelected]);

	useEffect(() => {
		if (!pendingDeleteColumnId) return;
		if (board.columns.some((column) => column.id === pendingDeleteColumnId)) return;
		setPendingDeleteColumnId(null);
	}, [board.columns, pendingDeleteColumnId]);

	const persistBoard = useCallback(
		(currentBoard: KanbanOverlayCustomData, nextBoard: KanbanOverlayCustomData, withHistory: boolean) => {
			const normalized = normalizeKanbanBoard(nextBoard);
			if (withHistory) {
				undoStackRef.current = pushKanbanHistory(undoStackRef.current, currentBoard);
				redoStackRef.current = [];
			}
			boardRef.current = normalized;
			setBoard(normalized);
			onChangeRef.current(element.id, normalized);
		},
		[element.id],
	);

	const updateBoard = useCallback<UpdateKanbanBoard>(
		(updater, options) => {
			const currentBoard = boardRef.current;
			const nextBoard = updater(currentBoard);
			if (nextBoard === currentBoard) return;
			persistBoard(currentBoard, nextBoard, Boolean(options?.history));
		},
		[persistBoard],
	);

	const handleUndo = useCallback(() => {
		const previous = undoStackRef.current.at(-1);
		if (!previous) return;

		const currentBoard = boardRef.current;
		undoStackRef.current = undoStackRef.current.slice(0, -1);
		redoStackRef.current = pushKanbanHistory(redoStackRef.current, currentBoard);

		const nextBoard = cloneKanbanBoard(previous);
		boardRef.current = nextBoard;
		setBoard(nextBoard);
		onChangeRef.current(element.id, nextBoard);
	}, [element.id]);

	const handleRedo = useCallback(() => {
		const nextFromRedo = redoStackRef.current.at(-1);
		if (!nextFromRedo) return;

		const currentBoard = boardRef.current;
		redoStackRef.current = redoStackRef.current.slice(0, -1);
		undoStackRef.current = pushKanbanHistory(undoStackRef.current, currentBoard);

		const nextBoard = cloneKanbanBoard(nextFromRedo);
		boardRef.current = nextBoard;
		setBoard(nextBoard);
		onChangeRef.current(element.id, nextBoard);
	}, [element.id]);

	const commitBoardTitle = useCallback(() => {
		if (boardTitleDraft.trim().length === 0) {
			setBoardTitleDraft(boardRef.current.title);
			return;
		}
		if (boardTitleDraft === boardRef.current.title) return;
		updateBoard((currentBoard) => ({ ...currentBoard, title: boardTitleDraft }), { history: false });
	}, [boardTitleDraft, updateBoard]);

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

	const handleRequestDeleteColumn = useCallback((columnId: string) => {
		setPendingDeleteColumnId(columnId);
	}, []);

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

	const handleDeletePendingColumn = useCallback(() => {
		const targetColumnId = pendingDeleteColumnId;
		if (!targetColumnId) return;

		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: currentBoard.columns.filter((column) => column.id !== targetColumnId),
			}),
			{ history: true },
		);
		setPendingDeleteColumnId(null);
	}, [pendingDeleteColumnId, updateBoard]);

	const handleAddColumn = useCallback(() => {
		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: [...currentBoard.columns, createKanbanColumn(currentBoard.columns.length)],
			}),
			{ history: true },
		);
	}, [updateBoard]);

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

	const dismissPanels = useCallback(() => {
		setShowSettings(false);
		setPendingDeleteColumnId(null);
	}, []);

	const handleEscapeKey = useCallback(() => {
		setShowSettings(false);
		setPendingDeleteColumnId(null);
		setSearchQuery('');
	}, []);

	const pendingDeleteColumn = useMemo(
		() => board.columns.find((column) => column.id === pendingDeleteColumnId) ?? null,
		[board.columns, pendingDeleteColumnId],
	);

	return {
		board,
		boardRef,
		boardTitleDraft,
		showSettings,
		pendingDeleteColumnId,
		pendingDeleteColumn,
		searchQuery,
		searchFocused,
		isLiveResizing,
		canUndo: undoStackRef.current.length > 0,
		canRedo: redoStackRef.current.length > 0,
		setBoardTitleDraft,
		setShowSettings,
		setPendingDeleteColumnId,
		setSearchQuery,
		setSearchFocused,
		updateBoard,
		handleUndo,
		handleRedo,
		commitBoardTitle,
		handleColumnChange,
		handleRequestDeleteColumn,
		handleAddCard,
		handleUpdateCard,
		handleDeleteCard,
		handleDeletePendingColumn,
		handleAddColumn,
		handleResetBoard,
		handleSetFont,
		handleAdjustFontSize,
		dismissPanels,
		handleEscapeKey,
	};
}
