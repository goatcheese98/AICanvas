import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useMountEffect } from '../../../hooks/useMountEffect';
import type { KanbanBoardProps } from './kanban-board-types';
import {
	formatRelativeTime,
	normalizeKanbanBoard,
	serializeKanbanBoard,
} from './kanban-utils';
import { useKanbanHistory } from './useKanbanHistory';
import { useKanbanMutations } from './useKanbanMutations';
import { useKanbanResize } from './useKanbanResize';

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
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const externalBoardSignatureRef = useRef(serializeKanbanBoard(normalizedInitialBoard));
	const lastBoardTitleRef = useRef(normalizedInitialBoard.title);
	const elementIdRef = useRef(element.id);

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

	// Sync with external element.customData changes
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

	// Sync board title draft when board title changes externally
	useEffect(() => {
		if (board.title === lastBoardTitleRef.current) return;

		lastBoardTitleRef.current = board.title;
		setBoardTitleDraft(board.title);
	}, [board.title]);

	// Activity reporting - track isSelected changes
	useEffect(() => {
		if (lastReportedEditingRef.current !== isSelected) {
			lastReportedEditingRef.current = isSelected;
			onActivityChangeRef.current?.(isSelected);
		}
	}, [isSelected]);

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

	// Extracted hooks - called early so effects can use their returned values
	const {
		undoStackRef,
		redoStackRef,
		handleUndo,
		handleRedo,
		canUndo,
		canRedo,
		clearStacks,
	} = useKanbanHistory({
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

	const {
		updateBoard,
		pendingDeleteColumnId,
		setPendingDeleteColumnId,
		pendingDeleteCardId,
		setPendingDeleteCardId,
		pendingDeleteCardColumnId,
		setPendingDeleteCardColumnId,
		pendingDeleteColumn,
		pendingDeleteCard,
		clearPendingDeletes,
		handleColumnChange,
		handleAddColumn,
		handleRequestDeleteColumn,
		handleDeletePendingColumn,
		handleAddCard,
		handleUpdateCard,
		handleRequestDeleteCard,
		handleCancelDeleteCard,
		handleDeletePendingCard,
		handleDeleteCard,
		handleResetBoard,
		handleSetFont,
		handleAdjustFontSize,
		commitBoardTitle,
	} = useKanbanMutations({
		elementId: element.id,
		board,
		boardRef,
		setBoard,
		onChange,
		undoStackRef,
		redoStackRef,
		boardTitleDraftRef,
		setBoardTitleDraft,
	});

	// Clear history stacks when element ID changes
	useEffect(() => {
		if (elementIdRef.current === element.id) return;
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
	}, [isSelected, element.id, clearPendingDeletes]);

	// UI helpers
	const dismissPanels = useCallback(() => {
		setShowSettings(false);
		clearPendingDeletes();
	}, [clearPendingDeletes]);

	const handleEscapeKey = useCallback(() => {
		setShowSettings(false);
		clearPendingDeletes();
		setSearchQuery('');
	}, [clearPendingDeletes]);

	const formattedLastUpdated = useMemo(() => {
		if (!board.lastUpdated) return '';
		return formatRelativeTime(board.lastUpdated);
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
		canUndo,
		canRedo,
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
