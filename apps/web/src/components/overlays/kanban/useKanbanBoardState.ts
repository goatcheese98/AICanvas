import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useMountEffect } from '../../../hooks/useMountEffect';
import type { KanbanBoardProps, UpdateKanbanBoard } from './kanban-board-types';
import {
	cloneKanbanBoard,
	createKanbanCard,
	createKanbanColumn,
	createStarterKanbanColumns,
	normalizeKanbanBoard,
	pushKanbanHistory,
	serializeKanbanBoard,
} from './kanban-utils';

interface UseKanbanBoardStateResult {
	board: KanbanOverlayCustomData;
	boardRef: MutableRefObject<KanbanOverlayCustomData>;
	boardTitleDraft: string;
	showSettings: boolean;
	pendingDeleteColumnId: string | null;
	pendingDeleteColumn: KanbanOverlayCustomData['columns'][number] | null;
	pendingDeleteCardId: string | null;
	pendingDeleteCardColumnId: string | null;
	pendingDeleteCard: KanbanOverlayCustomData['columns'][number]['cards'][number] | null;
	searchQuery: string;
	searchFocused: boolean;
	isLiveResizing: boolean;
	canUndo: boolean;
	canRedo: boolean;
	formattedLastUpdated: string;
	setBoardTitleDraft: Dispatch<SetStateAction<string>>;
	setShowSettings: Dispatch<SetStateAction<boolean>>;
	setPendingDeleteColumnId: Dispatch<SetStateAction<string | null>>;
	setPendingDeleteCardId: Dispatch<SetStateAction<string | null>>;
	setPendingDeleteCardColumnId: Dispatch<SetStateAction<string | null>>;
	setSearchQuery: Dispatch<SetStateAction<string>>;
	setSearchFocused: Dispatch<SetStateAction<boolean>>;
	updateBoard: UpdateKanbanBoard;
	handleUndo: () => void;
	handleRedo: () => void;
	commitBoardTitle: () => void;
	handleColumnChange: (
		columnId: string,
		updates: Partial<KanbanOverlayCustomData['columns'][number]>,
	) => void;
	handleRequestDeleteColumn: (columnId: string) => void;
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
	handleDeletePendingColumn: () => void;
	handleAddColumn: () => void;
	handleResetBoard: () => void;
	handleSetFont: (fontId: string) => void;
	handleAdjustFontSize: (delta: number) => void;
	dismissPanels: () => void;
	handleEscapeKey: () => void;
}

// External resize store for useSyncExternalStore
function createResizeStore() {
	let isResizing = false;
	let timeoutId: number | null = null;
	const listeners = new Set<() => void>();

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	function subscribe(listener: () => void) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	function getSnapshot() {
		return isResizing;
	}

	function startResizing() {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
		if (!isResizing) {
			isResizing = true;
			notify();
		}
		timeoutId = window.setTimeout(() => {
			isResizing = false;
			timeoutId = null;
			notify();
		}, 140);
	}

	return { subscribe, getSnapshot, startResizing };
}

export function useKanbanBoardState({
	element,
	mode,
	isSelected,
	isActive: _isActive,
	onChange,
	onActivityChange,
}: KanbanBoardProps): UseKanbanBoardStateResult {
	// Normalize initial board only once on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount
	const normalizedInitialBoard = useMemo(() => normalizeKanbanBoard(element.customData), []);

	const [board, setBoard] = useState<KanbanOverlayCustomData>(normalizedInitialBoard);
	const [boardTitleDraft, setBoardTitleDraft] = useState(normalizedInitialBoard.title);
	const [showSettings, setShowSettings] = useState(false);
	const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
	const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null);
	const [pendingDeleteCardColumnId, setPendingDeleteCardColumnId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchFocused, setSearchFocused] = useState(false);

	const undoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const redoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const boardRef = useRef(board);
	const boardTitleDraftRef = useRef(boardTitleDraft);
	const onChangeRef = useRef(onChange);
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const externalBoardSignatureRef = useRef(serializeKanbanBoard(normalizedInitialBoard));
	const lastBoardTitleRef = useRef(normalizedInitialBoard.title);
	const previousSizeRef = useRef({ width: element.width, height: element.height });
	const elementIdRef = useRef(element.id);
	const resizeStoreRef = useRef(createResizeStore());

	// Update refs on each render (not useEffect)
	boardRef.current = board;
	boardTitleDraftRef.current = boardTitleDraft;
	onChangeRef.current = onChange;
	onActivityChangeRef.current = onActivityChange;

	const nextExternalBoard = useMemo(
		() => normalizeKanbanBoard(element.customData),
		[element.customData],
	);
	const nextExternalSignature = useMemo(
		() => serializeKanbanBoard(nextExternalBoard),
		[nextExternalBoard],
	);

	// Track isSelected changes in ref for useEffect
	const lastIsSelectedForCleanupRef = useRef(isSelected);

	useEffect(() => {
		if (nextExternalSignature === externalBoardSignatureRef.current) return;

		externalBoardSignatureRef.current = nextExternalSignature;
		if (serializeKanbanBoard(boardRef.current) === nextExternalSignature) return;

		boardRef.current = nextExternalBoard;
		setBoard(nextExternalBoard);
		setBoardTitleDraft((current) =>
			current === nextExternalBoard.title ? current : nextExternalBoard.title,
		);
	}, [nextExternalBoard, nextExternalSignature]);

	useEffect(() => {
		if (elementIdRef.current === element.id) return;

		elementIdRef.current = element.id;
		undoStackRef.current = [];
		redoStackRef.current = [];
	}, [element.id]);

	useEffect(() => {
		if (board.title === lastBoardTitleRef.current) return;

		lastBoardTitleRef.current = board.title;
		setBoardTitleDraft(board.title);
	}, [board.title]);

	// Activity reporting - track isSelected changes - moved to useEffect
	useEffect(() => {
		if (lastReportedEditingRef.current !== isSelected) {
			lastReportedEditingRef.current = isSelected;
			onActivityChangeRef.current?.(isSelected);
		}
	}, [isSelected]);

	// Deselect handling - clear UI state and flush draft - moved to useEffect
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
			setPendingDeleteColumnId(null);
			setPendingDeleteCardId(null);
			setPendingDeleteCardColumnId(null);
		}
		lastIsSelectedForCleanupRef.current = isSelected;
	}, [isSelected, element.id]);

	// Resize handling with useSyncExternalStore
	const resizeStore = resizeStoreRef.current;
	const isLiveResizing = useSyncExternalStore(
		resizeStore.subscribe,
		resizeStore.getSnapshot,
		() => false,
	);

	useEffect(() => {
		const currentSize = { width: element.width, height: element.height };
		if (
			previousSizeRef.current.width === currentSize.width &&
			previousSizeRef.current.height === currentSize.height
		) {
			return;
		}

		previousSizeRef.current = currentSize;
		if (isSelected && mode !== 'shell') {
			resizeStore.startResizing();
		}
	}, [element.height, element.width, isSelected, mode, resizeStore]);

	// Cleanup on unmount
	useMountEffect(() => {
		return () => {
			// Flush draft on unmount
			const nextTitle = boardTitleDraftRef.current;
			if (nextTitle.trim().length > 0 && nextTitle !== boardRef.current.title) {
				const nextBoard = normalizeKanbanBoard({
					...boardRef.current,
					title: nextTitle,
				});
				boardRef.current = nextBoard;
				onChangeRef.current(element.id, nextBoard);
			}
			if (lastReportedEditingRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		};
	});

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

	const flushBoardTitleDraft = useCallback(() => {
		const nextTitle = boardTitleDraftRef.current;
		const currentBoard = boardRef.current;
		if (nextTitle.trim().length === 0 || nextTitle === currentBoard.title) return;

		const nextBoard = normalizeKanbanBoard({
			...currentBoard,
			title: nextTitle,
		});
		boardRef.current = nextBoard;
		onChangeRef.current(element.id, nextBoard);
	}, [element.id]);

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
		const nextTitle = boardTitleDraftRef.current;
		if (nextTitle.trim().length === 0) {
			setBoardTitleDraft(boardRef.current.title);
			return;
		}
		flushBoardTitleDraft();
	}, [flushBoardTitleDraft]);

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

	const handleRequestDeleteCard = useCallback((columnId: string, cardId: string) => {
		setPendingDeleteCardId(cardId);
		setPendingDeleteCardColumnId(columnId);
	}, []);

	const handleCancelDeleteCard = useCallback(() => {
		setPendingDeleteCardId(null);
		setPendingDeleteCardColumnId(null);
	}, []);

	const handleDeletePendingCard = useCallback(() => {
		const targetCardId = pendingDeleteCardId;
		const targetColumnId = pendingDeleteCardColumnId;
		if (!targetCardId || !targetColumnId) return;

		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: currentBoard.columns.map((candidate) =>
					candidate.id === targetColumnId
						? {
								...candidate,
								cards: candidate.cards.filter((card) => card.id !== targetCardId),
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
		setPendingDeleteCardId(null);
		setPendingDeleteCardColumnId(null);
	}, []);

	const handleEscapeKey = useCallback(() => {
		setShowSettings(false);
		setPendingDeleteColumnId(null);
		setPendingDeleteCardId(null);
		setPendingDeleteCardColumnId(null);
		setSearchQuery('');
	}, []);

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

	const formattedLastUpdated = useMemo(() => {
		if (!board.lastUpdated) return '';
		return new Date(board.lastUpdated).toLocaleString();
	}, [board.lastUpdated]);

	return {
		board,
		boardRef,
		boardTitleDraft,
		showSettings,
		pendingDeleteColumnId,
		pendingDeleteColumn,
		pendingDeleteCardId,
		pendingDeleteCardColumnId,
		pendingDeleteCard,
		searchQuery,
		searchFocused,
		isLiveResizing,
		canUndo: undoStackRef.current.length > 0,
		canRedo: redoStackRef.current.length > 0,
		formattedLastUpdated,
		setBoardTitleDraft,
		setShowSettings,
		setPendingDeleteColumnId,
		setPendingDeleteCardId,
		setPendingDeleteCardColumnId,
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
		handleRequestDeleteCard,
		handleCancelDeleteCard,
		handleDeletePendingCard,
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
