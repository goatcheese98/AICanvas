import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type {
	KanbanCard,
	KanbanColumn,
	KanbanOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';
import {
	cloneKanbanBoard,
	createStarterKanbanColumns,
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
	KANBAN_BACKGROUND_THEMES,
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

const KANBAN_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[10px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const KANBAN_ICON_BUTTON =
	'inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BUTTON_SURFACE_STYLE = {
	borderColor: 'var(--color-border)',
	background: 'var(--color-surface-strong)',
	color: 'var(--color-text-secondary)',
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
		cards: [],
	};
}

function ColumnDropIndicator() {
	return (
		<div className="flex h-full min-h-[8rem] items-center justify-center py-2">
			<div className="flex h-full items-center">
				<div
					className="h-full w-[3px] rounded-full"
					style={{
						background: 'var(--color-accent-text)',
						boxShadow:
							'0 0 0 4px color-mix(in srgb, var(--color-accent-bg) 55%, transparent)',
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
					<path d="M8 5.5H4.5V9" />
					<path d="M4.75 5.75A6.5 6.5 0 1 1 6.4 15.8" />
				</>
			) : (
				<>
					<path d="M12 5.5h3.5V9" />
					<path d="M15.25 5.75A6.5 6.5 0 1 0 13.6 15.8" />
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

export function KanbanBoard({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: KanbanBoardProps) {
	const [board, setBoard] = useState<KanbanOverlayCustomData>(() =>
		normalizeKanbanBoard(element.customData),
	);
	const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
	const [draggingFromColumnId, setDraggingFromColumnId] = useState<string | null>(null);
	const [cardOverColumnId, setCardOverColumnId] = useState<string | null>(null);
	const [overCardId, setOverCardId] = useState<string | null>(null);
	const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
	const [projectedColumnDropId, setProjectedColumnDropId] = useState<string | null>(null);
	const [isDeleteTargeted, setIsDeleteTargeted] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
	const undoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const redoStackRef = useRef<KanbanOverlayCustomData[]>([]);
	const boardRef = useRef(board);
	const settingsRef = useRef<HTMLDivElement>(null);
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);

	useEffect(() => {
		boardRef.current = board;
	}, [board]);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		const normalized = normalizeKanbanBoard(element.customData);
		boardRef.current = normalized;
		setBoard(normalized);
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

	const clearDragState = () => {
		setDraggingCardId(null);
		setDraggingFromColumnId(null);
		setCardOverColumnId(null);
		setOverCardId(null);
		setDraggingColumnId(null);
		setProjectedColumnDropId(null);
		setIsDeleteTargeted(false);
	};

	useEffect(() => {
		if (isSelected) return;
		setShowSettings(false);
		setPendingDeleteColumnId(null);
		clearDragState();
	}, [isSelected]);

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
			clearDragState();
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

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
	const boardCardCount = useMemo(
		() => board.columns.reduce((total, column) => total + column.cards.length, 0),
		[board.columns],
	);
	const pendingDeleteColumn = useMemo(
		() => board.columns.find((column) => column.id === pendingDeleteColumnId) ?? null,
		[board.columns, pendingDeleteColumnId],
	);

	const handleCardDragStart = (
		event: DragEvent<HTMLButtonElement>,
		cardId: string,
		columnId: string,
	) => {
		event.stopPropagation();
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', cardId);
		setDraggingCardId(cardId);
		setDraggingFromColumnId(columnId);
		setCardOverColumnId(columnId);
		setOverCardId(cardId);
		setDraggingColumnId(null);
		setProjectedColumnDropId(null);
		setIsDeleteTargeted(false);
	};

	const handleCardColumnDragOver = (event: DragEvent<HTMLDivElement>, columnId: string) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		setCardOverColumnId(columnId);
		setOverCardId(null);
		setIsDeleteTargeted(false);
	};

	const handleCardColumnDrop = (event: DragEvent<HTMLDivElement>, columnId: string) => {
		event.preventDefault();
		if (!draggingCardId) {
			clearDragState();
			return;
		}

		const targetCardId = cardOverColumnId === columnId ? overCardId : null;
		updateBoard(
			(currentBoard) => moveKanbanCard(currentBoard, draggingCardId, columnId, targetCardId),
			{ history: true },
		);
		clearDragState();
	};

	const handleColumnDragStart = (event: DragEvent<HTMLButtonElement>, columnId: string) => {
		event.stopPropagation();
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', columnId);
		setDraggingColumnId(columnId);
		setProjectedColumnDropId(columnId);
		setDraggingCardId(null);
		setDraggingFromColumnId(null);
		setCardOverColumnId(null);
		setOverCardId(null);
		setIsDeleteTargeted(false);
	};

	const handleColumnReorderDragOver = (
		event: DragEvent<HTMLDivElement>,
		hoveredColumnId: string,
	) => {
		event.preventDefault();
		if (!draggingColumnId) return;
		event.dataTransfer.dropEffect = 'move';
		const rect = event.currentTarget.getBoundingClientRect();
		const isPastMidpoint = event.clientX > rect.left + rect.width / 2;
		setProjectedColumnDropId(
			getProjectedOverColumnId(boardRef.current.columns, hoveredColumnId, isPastMidpoint),
		);
		setIsDeleteTargeted(false);
	};

	const handleColumnReorderDrop = (event: DragEvent<HTMLElement>) => {
		event.preventDefault();
		if (!draggingColumnId) {
			clearDragState();
			return;
		}

		updateBoard(
			(currentBoard) =>
				moveKanbanColumn(currentBoard, draggingColumnId, projectedColumnDropId),
			{ history: true },
		);
		clearDragState();
	};

	const handleDeleteDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (!draggingCardId) {
			clearDragState();
			return;
		}

		updateBoard(
			(currentBoard) => ({
				...currentBoard,
				columns: currentBoard.columns.map((column) => ({
					...column,
					cards: column.cards.filter((card) => card.id !== draggingCardId),
				})),
			}),
			{ history: true },
		);
		clearDragState();
	};

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			backgroundColor={element.backgroundColor}
			className="relative flex h-full min-h-0 flex-col"
			style={{
				fontFamily: activeFont.family,
				backgroundImage: activeTheme.boardBackground,
			}}
		>
			<div
				className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
				style={{
					borderColor: activeTheme.borderTone,
					background: activeTheme.headerBackground,
				}}
			>
				<div className="min-w-52 flex-1">
					<div
						className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
						style={{ color: 'var(--color-text-tertiary)' }}
					>
						Board
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							value={board.title}
							onChange={(event) =>
								updateBoard(
									(currentBoard) => ({ ...currentBoard, title: event.target.value }),
									{ history: false },
								)
							}
							className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold outline-none"
							style={{ color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
						/>
						<span
							className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
							style={{
								borderColor: KANBAN_ACCENT_BORDER,
								background: KANBAN_ACCENT_SURFACE,
								color: KANBAN_ACCENT_TEXT,
							}}
						>
							{board.columns.length} columns / {boardCardCount} cards
						</span>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
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
								borderTone={activeTheme.borderTone}
								isCardOver={cardOverColumnId === column.id}
								draggingCardId={draggingCardId}
								draggingFromColumnId={draggingFromColumnId}
								draggingColumnId={draggingColumnId}
								overCardId={cardOverColumnId === column.id ? overCardId : null}
								onChange={(updates) =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											columns: currentBoard.columns.map((candidate) =>
												candidate.id === column.id ? { ...candidate, ...updates } : candidate,
											),
										}),
										{ history: false },
									)
								}
								onRequestDelete={() => setPendingDeleteColumnId(column.id)}
								onAddCard={() =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											columns: currentBoard.columns.map((candidate) =>
												candidate.id === column.id
													? { ...candidate, cards: [...candidate.cards, createCard()] }
													: candidate,
											),
										}),
										{ history: true },
									)
								}
								onUpdateCard={(cardId, updates) =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											columns: currentBoard.columns.map((candidate) =>
												candidate.id === column.id
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
									)
								}
								onDeleteCard={(cardId) =>
									updateBoard(
										(currentBoard) => ({
											...currentBoard,
											columns: currentBoard.columns.map((candidate) =>
												candidate.id === column.id
													? {
															...candidate,
															cards: candidate.cards.filter((card) => card.id !== cardId),
														}
													: candidate,
											),
										}),
										{ history: true },
									)
								}
								onCardDragStart={handleCardDragStart}
								onCardDragEnd={clearDragState}
								onCardColumnDragOver={handleCardColumnDragOver}
								onCardColumnDrop={handleCardColumnDrop}
								onCardDragEnter={setOverCardId}
								onColumnDragStart={handleColumnDragStart}
								onColumnDragEnd={clearDragState}
								onColumnReorderDragOver={handleColumnReorderDragOver}
								onColumnReorderDrop={handleColumnReorderDrop}
							/>
						</div>
					))}

					{draggingColumnId && projectedColumnDropId === null ? <ColumnDropIndicator /> : null}

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
						className="flex h-full min-h-[12rem] min-w-[4.5rem] shrink-0 self-stretch items-center justify-center rounded-[20px] border border-dashed px-4 transition-colors"
						style={{
							borderColor: KANBAN_ACCENT_BORDER,
							background: 'color-mix(in srgb, var(--color-surface-strong) 78%, white)',
							color: KANBAN_ACCENT_TEXT,
						}}
						onDragOver={(event) => {
							if (!draggingColumnId) return;
							event.preventDefault();
							setProjectedColumnDropId(null);
							setIsDeleteTargeted(false);
						}}
						onDrop={(event) => {
							if (!draggingColumnId) return;
							handleColumnReorderDrop(event);
						}}
						title="Add column"
					>
						<div className="flex flex-col items-center gap-2">
							<div
								className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
								style={{
									borderColor: KANBAN_ACCENT_BORDER,
									background: KANBAN_ACCENT_SURFACE,
								}}
							>
								+
							</div>
							<div className="text-[10px] font-semibold uppercase tracking-[0.18em]">
								Column
							</div>
						</div>
					</button>
				</div>
			</div>

			{showSettings ? (
				<div
					ref={settingsRef}
					className="absolute right-4 top-[4.35rem] z-20 w-[17rem] rounded-[18px] border p-4 shadow-[var(--shadow-float)] backdrop-blur-md"
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
							Background
						</div>
						<div className="flex flex-wrap gap-2">
							{KANBAN_BACKGROUND_THEMES.map((theme) => (
								<button
									key={theme.id}
									type="button"
									onClick={() =>
										updateBoard(
											(currentBoard) => ({ ...currentBoard, bgTheme: theme.id }),
											{ history: true },
										)
									}
									className="h-8 w-8 rounded-full border transition-transform hover:scale-[1.04]"
									style={{
										borderColor:
											activeTheme.id === theme.id ? KANBAN_ACCENT_BORDER : 'var(--color-border)',
										background: theme.swatch,
										boxShadow:
											activeTheme.id === theme.id
												? '0 0 0 2px color-mix(in srgb, var(--color-accent-bg) 58%, white)'
												: 'none',
									}}
									title={theme.label}
								/>
							))}
						</div>
					</div>

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
							setIsDeleteTargeted(true);
							setCardOverColumnId(null);
							setOverCardId(null);
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
