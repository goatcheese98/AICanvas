import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useMountEffect } from '../../../hooks/useMountEffect';
import type { KanbanBoardProps } from './kanban-board-types';
import { formatRelativeTime, normalizeKanbanBoard } from './kanban-utils';
import { useKanbanActivity } from './useKanbanActivity';
import { useKanbanElementLifecycle } from './useKanbanElementLifecycle';
import { useKanbanExternalSync } from './useKanbanExternalSync';
import { useKanbanHistory } from './useKanbanHistory';
import { useKanbanMutations } from './useKanbanMutations';
import { useKanbanResize } from './useKanbanResize';
import { useKanbanTitleSync } from './useKanbanTitleSync';

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
	setBoardTitleDraft: React.Dispatch<React.SetStateAction<string>>;
	setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
	setPendingDeleteColumnId: (value: string | null) => void;
	setPendingDeleteCardId: (value: string | null) => void;
	setPendingDeleteCardColumnId: (value: string | null) => void;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	setSearchFocused: React.Dispatch<React.SetStateAction<boolean>>;
	updateBoard: (
		updater: (currentBoard: KanbanOverlayCustomData) => KanbanOverlayCustomData,
		options?: { history?: boolean },
	) => void;
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
	const [searchQuery, setSearchQuery] = useState('');
	const [searchFocused, setSearchFocused] = useState(false);

	const boardRef = useRef(board);
	const boardTitleDraftRef = useRef(boardTitleDraft);
	const onChangeRef = useRef(onChange);

	// Update refs on each render (not useEffect)
	boardRef.current = board;
	boardTitleDraftRef.current = boardTitleDraft;
	onChangeRef.current = onChange;

	// Extracted sync hooks
	const { clearStacks, ...history } = useKanbanHistory({
		elementId: element.id,
		boardRef,
		setBoard,
		onChange,
	});

	const { isLiveResizing } = useKanbanResize({
		elementWidth: element.width,
		elementHeight: element.height,
		isSelected,
		mode,
	});

	const mutations = useKanbanMutations({
		elementId: element.id,
		board,
		boardRef,
		setBoard,
		onChange,
		undoStackRef: history.undoStackRef,
		redoStackRef: history.redoStackRef,
		boardTitleDraftRef,
		setBoardTitleDraft,
	});

	// New focused sync hooks
	useKanbanExternalSync({
		element,
		boardRef,
		setBoard,
		setBoardTitleDraft,
	});

	useKanbanTitleSync({
		board,
		setBoardTitleDraft,
	});

	useKanbanActivity({
		isSelected,
		onActivityChange,
	});

	useKanbanElementLifecycle({
		element,
		isSelected,
		boardRef,
		boardTitleDraftRef,
		onChange,
		setShowSettings,
		clearPendingDeletes: mutations.clearPendingDeletes,
		clearStacks,
	});

	// Cleanup on unmount - flush draft
	useMountEffect(() => {
		return () => {
			const nextTitle = boardTitleDraftRef.current;
			if (nextTitle.trim().length > 0 && nextTitle !== boardRef.current.title) {
				const nextBoard = normalizeKanbanBoard({
					...boardRef.current,
					title: nextTitle,
				});
				boardRef.current = nextBoard;
				onChangeRef.current(element.id, nextBoard);
			}
		};
	});

	// UI helpers
	const dismissPanels = useCallback(() => {
		setShowSettings(false);
		mutations.clearPendingDeletes();
	}, [mutations.clearPendingDeletes]);

	const handleEscapeKey = useCallback(() => {
		setShowSettings(false);
		mutations.clearPendingDeletes();
		setSearchQuery('');
	}, [mutations.clearPendingDeletes]);

	const formattedLastUpdated = useMemo(() => {
		if (!board.lastUpdated) return '';
		return formatRelativeTime(board.lastUpdated);
	}, [board.lastUpdated]);

	return {
		board,
		boardRef,
		boardTitleDraft,
		showSettings,
		pendingDeleteColumnId: mutations.pendingDeleteColumnId,
		pendingDeleteColumn: mutations.pendingDeleteColumn,
		pendingDeleteCardId: mutations.pendingDeleteCardId,
		pendingDeleteCardColumnId: mutations.pendingDeleteCardColumnId,
		pendingDeleteCard: mutations.pendingDeleteCard,
		searchQuery,
		searchFocused,
		isLiveResizing,
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		formattedLastUpdated,
		setBoardTitleDraft,
		setShowSettings,
		setPendingDeleteColumnId: mutations.setPendingDeleteColumnId,
		setPendingDeleteCardId: mutations.setPendingDeleteCardId,
		setPendingDeleteCardColumnId: mutations.setPendingDeleteCardColumnId,
		setSearchQuery,
		setSearchFocused,
		updateBoard: mutations.updateBoard,
		handleUndo: history.handleUndo,
		handleRedo: history.handleRedo,
		commitBoardTitle: mutations.commitBoardTitle,
		handleColumnChange: mutations.handleColumnChange,
		handleRequestDeleteColumn: mutations.handleRequestDeleteColumn,
		handleAddCard: mutations.handleAddCard,
		handleUpdateCard: mutations.handleUpdateCard,
		handleRequestDeleteCard: mutations.handleRequestDeleteCard,
		handleCancelDeleteCard: mutations.handleCancelDeleteCard,
		handleDeletePendingCard: mutations.handleDeletePendingCard,
		handleDeleteCard: mutations.handleDeleteCard,
		handleDeletePendingColumn: mutations.handleDeletePendingColumn,
		handleAddColumn: mutations.handleAddColumn,
		handleResetBoard: mutations.handleResetBoard,
		handleSetFont: mutations.handleSetFont,
		handleAdjustFontSize: mutations.handleAdjustFontSize,
		dismissPanels,
		handleEscapeKey,
	};
}
