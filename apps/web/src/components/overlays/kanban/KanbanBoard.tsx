import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import type {
	KanbanCard,
	KanbanColumn,
	KanbanOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	getExcalidrawCornerRadius,
	getExcalidrawSurfaceStyle,
} from '@/components/canvas/excalidraw-element-style';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';
import {
	cloneKanbanBoard,
	createStarterKanbanColumns,
	getProjectedOverCardId,
	getProjectedOverColumnId,
	moveKanbanCard,
	moveKanbanColumn,
	normalizeKanbanBoard,
	pushKanbanHistory,
} from './kanban-utils';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_TEXT,
	KANBAN_FONT_OPTIONS,
	KANBAN_FONT_SIZE_RANGE,
	clampKanbanFontSize,
	getKanbanBackgroundTheme,
	getKanbanFontOption,
} from './kanban-theme';

type KanbanElement = ExcalidrawElement & {
	customData: KanbanOverlayCustomData;
};

interface KanbanBoardProps {
	element: KanbanElement;
	isSelected: boolean;
	onChange: (elementId: string, data: KanbanOverlayCustomData) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

// ---- Drag State (discriminated union + reducer) ----

type DragState =
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

function dragReducer(state: DragState, action: DragAction): DragState {
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

// ---- Helpers ----

const KANBAN_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const KANBAN_ICON_BUTTON =
	'inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BUTTON_SURFACE_STYLE = {
	borderColor: 'var(--color-border)',
	background: 'var(--color-surface-strong)',
	backgroundImage: 'var(--kanban-sketch-control-texture)',
	color: 'var(--color-text-secondary)',
	boxShadow: 'var(--kanban-sketch-control-shadow)',
};

function createCard(): KanbanCard {
	return {
		id: crypto.randomUUID(),
		title: 'New card',
		description: '',
		priority: 'medium',
		labels: [],
		checklist: [],
	};
}

function createColumn(index: number): KanbanColumn {
	const palette = ['#6965db', '#c28a42', '#557768', '#b35b55'];
	return {
		id: crypto.randomUUID(),
		title: 'New Column',
		color: palette[index % palette.length],
		cards: [createCard()],
	};
}

function ColumnDropIndicator() {
	return (
		<div className="flex h-full min-h-[8rem] items-center justify-center py-2">
			<div className="flex h-full items-center">
				<div
					className="h-full w-[4px] rounded-full transition-all duration-150"
					style={{
						background: 'var(--color-accent-text)',
						boxShadow:
							'0 0 0 5px color-mix(in srgb, var(--color-accent-bg) 58%, transparent)',
					}}
				/>
			</div>
		</div>
	);
}

function HistoryIcon({ direction }: { direction: 'undo' | 'redo' }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden="true"
		>
			{direction === 'undo' ? (
				<>
					<path d="M7 4 3.5 7.5 7 11" />
					<path d="M4 7.5h6a5 5 0 1 1 0 10H7" />
				</>
			) : (
				<>
					<path d="M13 4 16.5 7.5 13 11" />
					<path d="M16 7.5h-6a5 5 0 1 0 0 10h3" />
				</>
			)}
		</svg>
	);
}

function SettingsIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden="true"
		>
			<path d="M4 5.5h12" />
			<path d="M4 10h12" />
			<path d="M4 14.5h12" />
			<circle cx="7" cy="5.5" r="1.5" />
			<circle cx="13" cy="10" r="1.5" />
			<circle cx="9" cy="14.5" r="1.5" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden="true"
		>
			<path d="M10 4.5v11" />
			<path d="M4.5 10h11" />
		</svg>
	);
}

function SearchIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4 shrink-0"
			aria-hidden="true"
		>
			<circle cx="8.5" cy="8.5" r="5" />
			<path d="M14 14l3 3" />
		</svg>
	);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function getKanbanSketchVariables(roughness?: number): CSSProperties {
	const intensity = clamp((typeof roughness === 'number' ? roughness : 0) / 4, 0, 1);
	const textureAlpha = (0.012 + intensity * 0.032).toFixed(3);
	const highlightAlpha = (0.016 + intensity * 0.02).toFixed(3);
	const dividerAlpha = (0.065 + intensity * 0.085).toFixed(3);
	const cardEchoAlpha = (0.05 + intensity * 0.06).toFixed(3);
	const controlEchoAlpha = (0.035 + intensity * 0.05).toFixed(3);
	const edgeSoftAlpha = (0.08 + intensity * 0.12).toFixed(3);
	const edgeStrongAlpha = (0.12 + intensity * 0.14).toFixed(3);
	const cardTextureSpacing = (14 - intensity * 3).toFixed(2);
	const controlTextureSpacing = (18 - intensity * 4).toFixed(2);
	const cardTilt = (-7 - intensity * 7).toFixed(2);
	const crossTilt = (86 + intensity * 5).toFixed(2);
	const edgeOffset = (0.55 + intensity * 0.75).toFixed(2);
	const edgeOffsetAlt = (0.35 + intensity * 0.55).toFixed(2);
	const edgeTilt = (-0.18 - intensity * 0.45).toFixed(2);
	const edgeTiltAlt = (0.14 + intensity * 0.34).toFixed(2);

	return {
		'--kanban-sketch-intensity': `${intensity}`,
		'--kanban-sketch-card-texture':
			intensity > 0
				? [
						`repeating-linear-gradient(${cardTilt}deg, rgba(15, 23, 42, ${textureAlpha}) 0 1px, transparent 1px ${cardTextureSpacing}px)`,
						`repeating-linear-gradient(${crossTilt}deg, rgba(255, 255, 255, ${highlightAlpha}) 0 1px, transparent 1px ${(
							Number(cardTextureSpacing) + 2.5
						).toFixed(2)}px)`,
				  ].join(', ')
				: 'none',
		'--kanban-sketch-control-texture':
			intensity > 0
				? `repeating-linear-gradient(${(-12 - intensity * 8).toFixed(2)}deg, rgba(15, 23, 42, ${(
						Number(textureAlpha) * 0.85
					).toFixed(3)}) 0 1px, transparent 1px ${controlTextureSpacing}px)`
				: 'none',
		'--kanban-sketch-divider':
			intensity > 0
				? `linear-gradient(90deg, rgba(15, 23, 42, ${dividerAlpha}) 0%, rgba(15, 23, 42, ${(
						Number(dividerAlpha) * 0.34
					).toFixed(3)}) 48%, rgba(15, 23, 42, ${dividerAlpha}) 100%)`
				: 'none',
		'--kanban-sketch-card-shadow':
			intensity > 0
				? `${(0.75 + intensity * 0.9).toFixed(2)}px ${(1.25 + intensity * 1.15).toFixed(2)}px 0 rgba(15, 23, 42, ${cardEchoAlpha})`
				: 'none',
		'--kanban-sketch-control-shadow':
			intensity > 0
				? `${(0.55 + intensity * 0.6).toFixed(2)}px ${(0.95 + intensity * 0.8).toFixed(2)}px 0 rgba(15, 23, 42, ${controlEchoAlpha})`
				: 'none',
		'--kanban-sketch-edge-soft': `rgba(15, 23, 42, ${edgeSoftAlpha})`,
		'--kanban-sketch-edge-strong': `rgba(15, 23, 42, ${edgeStrongAlpha})`,
		'--kanban-sketch-edge-offset': `${edgeOffset}px`,
		'--kanban-sketch-edge-offset-alt': `${edgeOffsetAlt}px`,
		'--kanban-sketch-edge-tilt': `${edgeTilt}deg`,
		'--kanban-sketch-edge-tilt-alt': `${edgeTiltAlt}deg`,
	} as CSSProperties;
}

export function KanbanBoard({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: KanbanBoardProps) {
	const [board, setBoard] = useState<KanbanOverlayCustomData>(() =>
		normalizeKanbanBoard(element.customData),
	);
	const [boardTitleDraft, setBoardTitleDraft] = useState(() => normalizeKanbanBoard(element.customData).title);
	const [dragState, dispatchDrag] = useReducer(dragReducer, { mode: 'idle' });
	const [showSettings, setShowSettings] = useState(false);
	const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchFocused, setSearchFocused] = useState(false);
	const undoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const redoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const boardRef = useRef(board);
	const dragStateRef = useRef<DragState>({ mode: 'idle' });
	const settingsRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);

	useEffect(() => {
		boardRef.current = board;
	}, [board]);

	useEffect(() => {
		dragStateRef.current = dragState;
	}, [dragState]);

	useEffect(() => {
		setBoardTitleDraft(board.title);
	}, [board.title]);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		const normalized = normalizeKanbanBoard(element.customData);
		boardRef.current = normalized;
		setBoard(normalized);
		setBoardTitleDraft(normalized.title);
	}, [element.customData]);

	useEffect(() => {
		undoStackRef.current = [];
		redoStackRef.current = [];
	}, [element.id]);

	useEffect(() => {
		if (lastReportedEditingRef.current === isSelected) return;
		lastReportedEditingRef.current = isSelected;
		onEditingChangeRef.current?.(isSelected);
	}, [isSelected]);

	useEffect(
		() => () => {
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[],
	);

	const clearDragState = useCallback(() => {
		dispatchDrag({ type: 'CLEAR' });
	}, []);

	useEffect(() => {
		if (isSelected) return;
		setShowSettings(false);
		setPendingDeleteColumnId(null);
		clearDragState();
	}, [isSelected, clearDragState]);

	useEffect(() => {
		if (!pendingDeleteColumnId) return;
		if (board.columns.some((column) => column.id === pendingDeleteColumnId)) return;
		setPendingDeleteColumnId(null);
	}, [board.columns, pendingDeleteColumnId]);

	useEffect(() => {
		if (!showSettings) return;

		const handlePointerDown = (event: MouseEvent) => {
			if (!settingsRef.current?.contains(event.target as Node)) {
				setShowSettings(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		return () => document.removeEventListener('mousedown', handlePointerDown);
	}, [showSettings]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			setShowSettings(false);
			setPendingDeleteColumnId(null);
			setSearchQuery('');
			clearDragState();
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [clearDragState]);

	const persistBoard = (
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
		onChange(element.id, normalized);
	};

	const updateBoard = (
		updater: (currentBoard: KanbanOverlayCustomData) => KanbanOverlayCustomData,
		options?: { history?: boolean },
	) => {
		const currentBoard = boardRef.current;
		const nextBoard = updater(currentBoard);
		if (nextBoard === currentBoard) return;
		persistBoard(currentBoard, nextBoard, Boolean(options?.history));
	};

	const handleUndo = () => {
		const previous = undoStackRef.current.at(-1);
		if (!previous) return;

		const currentBoard = boardRef.current;
		undoStackRef.current = undoStackRef.current.slice(0, -1);
		redoStackRef.current = pushKanbanHistory(redoStackRef.current, currentBoard);

		const nextBoard = cloneKanbanBoard(previous);
		boardRef.current = nextBoard;
		setBoard(nextBoard);
		onChange(element.id, nextBoard);
	};

	const handleRedo = () => {
		const nextFromRedo = redoStackRef.current.at(-1);
		if (!nextFromRedo) return;

		const currentBoard = boardRef.current;
		redoStackRef.current = redoStackRef.current.slice(0, -1);
		undoStackRef.current = pushKanbanHistory(undoStackRef.current, currentBoard);

		const nextBoard = cloneKanbanBoard(nextFromRedo);
		boardRef.current = nextBoard;
		setBoard(nextBoard);
		onChange(element.id, nextBoard);
	};

	const activeTheme = getKanbanBackgroundTheme(board.bgTheme);
	const activeFont = getKanbanFontOption(board.fontId);
	const fontSize = clampKanbanFontSize(board.fontSize);
	const sketchVariables = useMemo(() => getKanbanSketchVariables(element.roughness), [element.roughness]);
	const elementRoundness =
		(element.roundness as { type: number; value?: number } | null | undefined) ?? null;
	const cardRadius = useMemo(() => {
		const radius = getExcalidrawCornerRadius(320, 220, elementRoundness);
		return radius > 0 ? Math.max(10, Math.round(radius * 0.42)) : 6;
	}, [elementRoundness]);
	const columnRadius = useMemo(() => {
		const radius = getExcalidrawCornerRadius(344, 240, elementRoundness);
		return radius > 0 ? Math.max(12, Math.round(radius * 0.46)) : 8;
	}, [elementRoundness]);
	const controlRadius = useMemo(() => {
		const radius = getExcalidrawCornerRadius(120, 44, elementRoundness);
		return radius > 0 ? Math.max(8, Math.round(cardRadius * 0.55)) : 5;
	}, [elementRoundness, cardRadius]);
	const boardFillSurface = useMemo(
		() =>
			getExcalidrawSurfaceStyle({
				backgroundColor: element.backgroundColor,
				fillStyle: (element.fillStyle as 'solid' | 'hachure' | 'cross-hatch') ?? 'solid',
				opacity: element.opacity,
				includeStroke: false,
			}),
		[element.backgroundColor, element.fillStyle, element.opacity],
	);
	const boardCardCount = useMemo(
		() => board.columns.reduce((total, column) => total + column.cards.length, 0),
		[board.columns],
	);
	const pendingDeleteColumn = useMemo(
		() => board.columns.find((column) => column.id === pendingDeleteColumnId) ?? null,
		[board.columns, pendingDeleteColumnId],
	);

	const commitBoardTitle = useCallback(() => {
		if (boardTitleDraft.trim().length === 0) {
			setBoardTitleDraft(boardRef.current.title);
			return;
		}
		if (boardTitleDraft === boardRef.current.title) return;
		updateBoard((currentBoard) => ({ ...currentBoard, title: boardTitleDraft }), { history: false });
	}, [boardTitleDraft]);

	// ---- Drag handlers (stable via useCallback, columnId passed as arg) ----

	const handleCardDragStart = useCallback(
		(event: DragEvent<HTMLElement>, cardId: string, columnId: string) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', '_');
			event.dataTransfer.setData('application/x-ai-canvas-kanban-card', cardId);
			event.dataTransfer.setDragImage(event.currentTarget, 12, 12);
			dispatchDrag({ type: 'CARD_START', cardId, fromColumnId: columnId });
		},
		[],
	);

	const handleCardColumnDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>, columnId: string) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			dispatchDrag({ type: 'CARD_OVER', overColumnId: columnId, overCardId: null });
		},
		[],
	);

	const handleCardColumnDrop = useCallback(
		(event: DragEvent<HTMLDivElement>, columnId: string) => {
			event.preventDefault();
			if (dragState.mode !== 'card') {
				clearDragState();
				return;
			}

			const { cardId, overColumnId, overCardId } = dragState;
			const targetCardId = overColumnId === columnId ? overCardId : null;
			updateBoard(
				(currentBoard) => moveKanbanCard(currentBoard, cardId, columnId, targetCardId),
				{ history: true },
			);
			clearDragState();
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[dragState, clearDragState],
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
			const currentDragState = dragStateRef.current;
			const previousProjectedCardId =
				currentDragState.mode === 'card' && currentDragState.overColumnId === columnId
					? currentDragState.overCardId
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
		[],
	);

	const handleColumnDragStart = useCallback(
		(event: DragEvent<HTMLElement>, columnId: string) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', columnId);
			dispatchDrag({ type: 'COLUMN_START', columnId });
		},
		[],
	);

	const handleColumnReorderDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>, hoveredColumnId: string) => {
			event.preventDefault();
			if (dragState.mode !== 'column') return;
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
		[dragState.mode],
	);

	const handleColumnReorderDrop = useCallback(
		(event: DragEvent<HTMLElement>) => {
			event.preventDefault();
			if (dragState.mode !== 'column') {
				clearDragState();
				return;
			}

			const { columnId, projectedDropId } = dragState;
			updateBoard(
				(currentBoard) => moveKanbanColumn(currentBoard, columnId, projectedDropId),
				{ history: true },
			);
			clearDragState();
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[dragState, clearDragState],
	);

	const handleDeleteDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (dragState.mode !== 'card') {
			clearDragState();
			return;
		}

		const { cardId } = dragState;
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
	};

	// ---- Per-column stable callbacks (accept columnId, stabilized via useCallback) ----

	const handleColumnChange = useCallback(
		(columnId: string, updates: Partial<KanbanColumn>) => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
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
							? { ...candidate, cards: [...candidate.cards, createCard()] }
							: candidate,
					),
				}),
				{ history: true },
			);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const handleUpdateCard = useCallback(
		(columnId: string, cardId: string, updates: Partial<KanbanCard>) => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const draggingCardId = dragState.mode === 'card' ? dragState.cardId : null;
	const draggingFromColumnId = dragState.mode === 'card' ? dragState.fromColumnId : null;
	const cardOverColumnId = dragState.mode === 'card' ? dragState.overColumnId : null;
	const overCardId = dragState.mode === 'card' ? dragState.overCardId : null;
	const draggingColumnId = dragState.mode === 'column' ? dragState.columnId : null;
	const projectedColumnDropId = dragState.mode === 'column' ? dragState.projectedDropId : null;
	const isDeleteTargeted = dragState.mode === 'card' ? dragState.isDeleteTargeted : false;

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			backgroundColor={element.backgroundColor}
			inheritFillStyle={false}
			className="relative flex h-full min-h-0 flex-col"
			style={{
				fontFamily: activeFont.family,
				backgroundColor: boardFillSurface.backgroundColor,
				backgroundImage: boardFillSurface.backgroundImage,
				...sketchVariables,
			}}
		>
			<div
				className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5"
				style={{
					borderColor: activeTheme.borderTone,
					background: activeTheme.headerBackground,
				}}
			>
				<div className="min-w-52 flex-1">
					<input
						value={boardTitleDraft}
						onChange={(event) => setBoardTitleDraft(event.target.value)}
						onBlur={commitBoardTitle}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								event.currentTarget.blur();
							}
						}}
						maxLength={120}
						className="min-w-0 w-full border-0 bg-transparent text-[15px] font-semibold outline-none"
						style={{ color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					<span
						className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{
							borderColor: KANBAN_ACCENT_BORDER,
							background: KANBAN_ACCENT_SURFACE,
							backgroundImage: 'var(--kanban-sketch-control-texture)',
							color: KANBAN_ACCENT_TEXT,
							boxShadow: 'var(--kanban-sketch-control-shadow)',
						}}
					>
						{board.columns.length} columns / {boardCardCount} cards
					</span>

					{/* Search input */}
					<div
						className={`flex shrink-0 items-center rounded-[10px] border transition-all ${
							searchFocused || searchQuery ? 'justify-start gap-2 px-2.5' : 'justify-center px-0'
						}`}
						style={{
							borderColor: searchFocused || searchQuery
								? KANBAN_ACCENT_BORDER
								: 'var(--color-border)',
							background: searchFocused || searchQuery
								? KANBAN_ACCENT_SURFACE
								: 'var(--color-surface-strong)',
							backgroundImage: 'var(--kanban-sketch-control-texture)',
							color: searchQuery ? KANBAN_ACCENT_TEXT : 'var(--color-text-secondary)',
							height: '2rem',
							width: searchFocused || searchQuery ? '9rem' : '2rem',
							boxShadow: 'var(--kanban-sketch-control-shadow)',
						}}
					>
						<SearchIcon />
						<input
							ref={searchInputRef}
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							onFocus={() => setSearchFocused(true)}
							onBlur={() => setSearchFocused(false)}
							onKeyDown={(event) => {
								if (event.key === 'Escape') {
									setSearchQuery('');
									event.currentTarget.blur();
								}
							}}
							placeholder="Search cards…"
							className="min-w-0 flex-1 border-0 bg-transparent text-[11px] outline-none"
							style={{
								color: 'var(--color-text-primary)',
								fontFamily: 'inherit',
								display: searchFocused || searchQuery ? undefined : 'none',
							}}
						/>
					</div>

					<button
						type="button"
						onClick={handleUndo}
						disabled={undoStackRef.current.length === 0}
						className={KANBAN_ICON_BUTTON}
						style={BUTTON_SURFACE_STYLE}
						title="Undo"
					>
						<HistoryIcon direction="undo" />
					</button>
					<button
						type="button"
						onClick={handleRedo}
						disabled={redoStackRef.current.length === 0}
						className={KANBAN_ICON_BUTTON}
						style={BUTTON_SURFACE_STYLE}
						title="Redo"
					>
						<HistoryIcon direction="redo" />
					</button>
					<button
						type="button"
						onClick={() => setShowSettings((current) => !current)}
						className={KANBAN_ICON_BUTTON}
						style={{
							...BUTTON_SURFACE_STYLE,
							borderColor: showSettings ? KANBAN_ACCENT_BORDER : BUTTON_SURFACE_STYLE.borderColor,
							background: showSettings ? KANBAN_ACCENT_SURFACE : BUTTON_SURFACE_STYLE.background,
							color: showSettings ? KANBAN_ACCENT_TEXT : BUTTON_SURFACE_STYLE.color,
						}}
						title="Board appearance"
					>
						<SettingsIcon />
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto px-3 py-3">
				<div className="flex min-w-full items-start gap-3 pb-4">
					{board.columns.map((column) => (
						<div key={column.id} className="flex h-full items-stretch gap-3">
							{draggingColumnId &&
							projectedColumnDropId === column.id &&
							draggingColumnId !== column.id ? (
								<ColumnDropIndicator />
							) : null}
							<KanbanColumnView
								column={column}
								fontSize={fontSize}
								columnBackground={activeTheme.columnBackground}
								cardBackground={activeTheme.cardBackground}
								cardRadius={cardRadius}
								controlRadius={controlRadius}
								columnRadius={columnRadius}
								borderTone={activeTheme.borderTone}
								isCardOver={cardOverColumnId === column.id}
								draggingCardId={draggingCardId}
								draggingFromColumnId={draggingFromColumnId}
								draggingColumnId={draggingColumnId}
								overCardId={cardOverColumnId === column.id ? overCardId : null}
								searchQuery={searchQuery}
								onChange={(updates) => handleColumnChange(column.id, updates)}
								onRequestDelete={() => handleRequestDeleteColumn(column.id)}
								onAddCard={() => handleAddCard(column.id)}
								onUpdateCard={(cardId, updates) => handleUpdateCard(column.id, cardId, updates)}
								onDeleteCard={(cardId) => handleDeleteCard(column.id, cardId)}
								onCardDragStart={handleCardDragStart}
								onCardDragEnd={clearDragState}
								onCardColumnDragOver={handleCardColumnDragOver}
								onCardColumnDrop={handleCardColumnDrop}
								onCardDragOverTarget={handleCardDragOverTarget}
								onColumnDragStart={handleColumnDragStart}
								onColumnDragEnd={clearDragState}
								onColumnReorderDragOver={handleColumnReorderDragOver}
								onColumnReorderDrop={handleColumnReorderDrop}
							/>
						</div>
					))}

					{draggingColumnId && projectedColumnDropId === null ? <ColumnDropIndicator /> : null}

					<div className="flex min-w-[20.5rem] max-w-[20.5rem] shrink-0 self-start flex-col px-1 py-2">
						<div aria-hidden="true" className="h-[3.1rem]" />
						<div className="mt-4 flex items-start justify-start px-2">
							<button
								type="button"
								onClick={() =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											columns: [...currentBoard.columns, createColumn(currentBoard.columns.length)],
										}),
										{ history: true },
									)
								}
								className="inline-flex items-center gap-2 border border-dashed px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors"
								style={{
									borderRadius: `${Math.max(controlRadius, 0)}px`,
									borderColor: KANBAN_ACCENT_BORDER,
									background: 'color-mix(in srgb, var(--color-surface-strong) 72%, white)',
									backgroundImage: 'var(--kanban-sketch-control-texture)',
									color: KANBAN_ACCENT_TEXT,
									boxShadow: 'var(--kanban-sketch-control-shadow)',
								}}
								onDragOver={(event) => {
									if (!draggingColumnId) return;
									event.preventDefault();
									dispatchDrag({ type: 'COLUMN_OVER', projectedDropId: null });
								}}
								onDrop={(event) => {
									if (!draggingColumnId) return;
									handleColumnReorderDrop(event);
								}}
								title="Add column"
							>
								<PlusIcon />
								Add
							</button>
						</div>
					</div>
				</div>
			</div>

			{showSettings ? (
				<div
					ref={settingsRef}
					className="absolute right-3 top-[3.85rem] z-20 w-[16rem] rounded-[18px] border p-4 shadow-[var(--shadow-float)] backdrop-blur-md"
					style={{
						borderColor: 'var(--color-border)',
						background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
					}}
				>
					<div className="mb-4">
						<div
							className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
							style={{ color: 'var(--color-text-tertiary)' }}
						>
							Font
						</div>
						<div className="space-y-2">
							{KANBAN_FONT_OPTIONS.map((font) => {
								const isActive = activeFont.id === font.id;
								return (
									<button
										key={font.id}
										type="button"
										onClick={() =>
											updateBoard(
												(currentBoard) => ({ ...currentBoard, fontId: font.id }),
												{ history: true },
											)
										}
										className="w-full rounded-[12px] border px-3 py-2 text-left text-sm transition-colors"
										style={{
											borderColor: isActive ? KANBAN_ACCENT_BORDER : 'var(--color-border)',
											background: isActive ? KANBAN_ACCENT_SURFACE : 'transparent',
											color: isActive ? KANBAN_ACCENT_TEXT : 'var(--color-text-primary)',
											fontFamily: font.family,
										}}
									>
										{font.label}
									</button>
								);
							})}
						</div>
					</div>

					<div>
						<div
							className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
							style={{ color: 'var(--color-text-tertiary)' }}
						>
							Font size
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											fontSize: clampKanbanFontSize(fontSize - 1),
										}),
										{ history: true },
									)
								}
								disabled={fontSize <= KANBAN_FONT_SIZE_RANGE.min}
								className={KANBAN_ICON_BUTTON}
								style={BUTTON_SURFACE_STYLE}
							>
								−
							</button>
							<div
								className="flex-1 rounded-[12px] border px-3 py-2 text-center text-sm font-semibold"
								style={{
									borderColor: 'var(--color-border)',
									background: 'color-mix(in srgb, var(--color-surface-muted) 88%, white)',
									color: 'var(--color-text-primary)',
								}}
							>
								{fontSize}px
							</div>
							<button
								type="button"
								onClick={() =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											fontSize: clampKanbanFontSize(fontSize + 1),
										}),
										{ history: true },
									)
								}
								disabled={fontSize >= KANBAN_FONT_SIZE_RANGE.max}
								className={KANBAN_ICON_BUTTON}
								style={BUTTON_SURFACE_STYLE}
							>
								+
							</button>
						</div>
					</div>

					<div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
						<button
							type="button"
							onClick={() =>
								updateBoard(
									(currentBoard) => ({
										...currentBoard,
										columns: createStarterKanbanColumns(),
									}),
									{ history: true },
								)
							}
							className={`${KANBAN_BUTTON} w-full`}
							style={BUTTON_SURFACE_STYLE}
						>
							Reset board
						</button>
					</div>
				</div>
			) : null}

			{draggingCardId ? (
				<div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
					<div
						className="pointer-events-auto inline-flex min-w-[13rem] items-center justify-center rounded-[16px] border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all"
						style={{
							borderColor: isDeleteTargeted ? 'var(--color-danger-border)' : 'var(--color-border)',
							background: isDeleteTargeted
								? 'color-mix(in srgb, var(--color-danger-bg) 86%, white)'
								: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
							color: isDeleteTargeted ? 'var(--color-danger-text)' : 'var(--color-text-secondary)',
							boxShadow: isDeleteTargeted
								? '0 12px 28px rgba(179,91,85,0.16)'
								: '0 12px 28px rgba(15,23,42,0.12)',
						}}
						onDragOver={(event) => {
							event.preventDefault();
							dispatchDrag({ type: 'CARD_DELETE_TARGET' });
						}}
						onDrop={handleDeleteDrop}
					>
						Drop here to delete
					</div>
				</div>
			) : null}

			{pendingDeleteColumn ? (
				<div
					className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(15,23,42,0.24)] p-4"
					onMouseDown={(event) => {
						if (event.currentTarget === event.target) {
							setPendingDeleteColumnId(null);
						}
					}}
				>
					<div
						className="w-full max-w-[25rem] rounded-[22px] border p-5 shadow-[var(--shadow-float)]"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
						}}
						onMouseDown={(event) => event.stopPropagation()}
					>
						<div
							className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
							style={{ color: 'var(--color-danger-text)' }}
						>
							Remove column
						</div>
						<div className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
							Delete &quot;{pendingDeleteColumn.title}&quot;?
						</div>
						<div className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
							This removes the column and its {pendingDeleteColumn.cards.length} card
							{pendingDeleteColumn.cards.length === 1 ? '' : 's'}.
						</div>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setPendingDeleteColumnId(null)}
								className={KANBAN_BUTTON}
								style={BUTTON_SURFACE_STYLE}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											columns: currentBoard.columns.filter(
												(column) => column.id !== pendingDeleteColumn.id,
											),
										}),
										{ history: true },
									);
									setPendingDeleteColumnId(null);
								}}
								className={KANBAN_BUTTON}
								style={{
									borderColor: 'var(--color-danger-border)',
									background: 'var(--color-danger-bg)',
									color: 'var(--color-danger-text)',
								}}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			) : null}
		</OverlaySurface>
	);
}
