import {
	getExcalidrawCornerRadius,
	getExcalidrawSurfaceStyle,
} from '@/components/canvas/excalidraw-element-style';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { KanbanBoardHeader } from './KanbanBoardHeader';
import { KanbanBoardSettingsPanel } from './KanbanBoardSettingsPanel';
import { KanbanColumn as KanbanColumnView } from './KanbanColumn';
import { KanbanDeleteColumnDialog } from './KanbanDeleteColumnDialog';
import { KanbanDeleteDropZone } from './KanbanDeleteDropZone';
import type { KanbanBoardProps } from './kanban-board-types';
import {
	clampKanbanFontSize,
	getKanbanBackgroundTheme,
	getKanbanFontOption,
	getKanbanSketchVariables,
} from './kanban-theme';
import { useKanbanBoardState } from './useKanbanBoardState';
import { useKanbanDragState } from './useKanbanDragState';

function ColumnDropIndicator() {
	return (
		<div className="flex h-full min-h-[8rem] items-center justify-center py-2">
			<div className="flex h-full items-center">
				<div
					className="h-full w-[4px] rounded-full transition-all duration-150"
					style={{
						background: 'var(--color-accent-text)',
						boxShadow: '0 0 0 5px color-mix(in srgb, var(--color-accent-bg) 58%, transparent)',
					}}
				/>
			</div>
		</div>
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

export function KanbanBoardContainer({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: KanbanBoardProps) {
	const settingsRef = useRef<HTMLDivElement>(null);
	const state = useKanbanBoardState({ element, isSelected, onChange, onEditingChange });
	const drag = useKanbanDragState({
		boardRef: state.boardRef,
		updateBoard: state.updateBoard,
	});

	useEffect(() => {
		if (isSelected) return;
		drag.clearDragState();
	}, [drag.clearDragState, isSelected]);

	useEffect(() => {
		if (!state.showSettings) return;

		const handlePointerDown = (event: MouseEvent) => {
			if (!settingsRef.current?.contains(event.target as Node)) {
				state.setShowSettings(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		return () => document.removeEventListener('mousedown', handlePointerDown);
	}, [state.setShowSettings, state.showSettings]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			state.handleEscapeKey();
			drag.clearDragState();
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [drag.clearDragState, state.handleEscapeKey]);

	const activeTheme = getKanbanBackgroundTheme(state.board.bgTheme);
	const activeFont = getKanbanFontOption(state.board.fontId);
	const fontSize = clampKanbanFontSize(state.board.fontSize);
	const sketchVariables = useMemo(
		() => getKanbanSketchVariables(element.roughness, state.isLiveResizing),
		[element.roughness, state.isLiveResizing],
	);
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
	}, [cardRadius, elementRoundness]);
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
		() => state.board.columns.reduce((total, column) => total + column.cards.length, 0),
		[state.board.columns],
	);
	const responsiveColumnWidth = useMemo(() => {
		const columnCount = Math.max(state.board.columns.length, 1);
		const boardInnerWidth = Math.max(element.width - 104, 320);
		const addLaneAllowance = 70;
		const gapAllowance = Math.max(0, (columnCount - 1) * 12);
		const availableWidth = Math.max(boardInnerWidth - addLaneAllowance - gapAllowance, 220);
		return Math.max(240, Math.min(availableWidth / columnCount, 360));
	}, [element.width, state.board.columns.length]);
	const motionVariables = useMemo(
		() =>
			({
				'--kanban-motion-duration': state.isLiveResizing ? '0ms' : '200ms',
				'--kanban-motion-duration-fast': state.isLiveResizing ? '0ms' : '150ms',
				'--kanban-card-min-height': `${Math.max(156, Math.min(element.height * 0.16, 220))}px`,
				'--kanban-card-max-height': `${Math.max(260, Math.min(element.height * 0.42, 420))}px`,
				'--kanban-column-width': `${responsiveColumnWidth}px`,
			}) as CSSProperties,
		[element.height, responsiveColumnWidth, state.isLiveResizing],
	);

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
				...motionVariables,
				...sketchVariables,
			}}
		>
			<KanbanBoardHeader
				boardTitleDraft={state.boardTitleDraft}
				boardColumnCount={state.board.columns.length}
				boardCardCount={boardCardCount}
				searchQuery={state.searchQuery}
				searchFocused={state.searchFocused}
				canUndo={state.canUndo}
				canRedo={state.canRedo}
				showSettings={state.showSettings}
				headerBackground={activeTheme.headerBackground}
				borderTone={activeTheme.borderTone}
				onBoardTitleDraftChange={state.setBoardTitleDraft}
				onCommitBoardTitle={state.commitBoardTitle}
				onSearchQueryChange={state.setSearchQuery}
				onSearchFocusChange={state.setSearchFocused}
				onUndo={state.handleUndo}
				onRedo={state.handleRedo}
				onToggleSettings={() => state.setShowSettings((current) => !current)}
			/>

			<div className="min-h-0 flex-1 overflow-auto px-3 py-2">
				<div className="flex min-w-full items-start gap-2 pb-4">
					{state.board.columns.map((column) => (
						<div key={column.id} className="flex h-full items-stretch gap-3">
							{drag.draggingColumnId &&
							drag.projectedColumnDropId === column.id &&
							drag.draggingColumnId !== column.id ? (
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
								isLiveResizing={state.isLiveResizing}
								isCardOver={drag.cardOverColumnId === column.id}
								draggingCardId={drag.draggingCardId}
								draggingFromColumnId={drag.draggingFromColumnId}
								draggingColumnId={drag.draggingColumnId}
								overCardId={drag.cardOverColumnId === column.id ? drag.overCardId : null}
								searchQuery={state.searchQuery}
								onChange={(updates) => state.handleColumnChange(column.id, updates)}
								onRequestDelete={() => state.handleRequestDeleteColumn(column.id)}
								onAddCard={() => state.handleAddCard(column.id)}
								onUpdateCard={(cardId, updates) =>
									state.handleUpdateCard(column.id, cardId, updates)
								}
								onDeleteCard={(cardId) => state.handleDeleteCard(column.id, cardId)}
								onCardDragStart={drag.handleCardDragStart}
								onCardDragEnd={drag.clearDragState}
								onCardColumnDragOver={drag.handleCardColumnDragOver}
								onCardColumnDrop={drag.handleCardColumnDrop}
								onCardDragOverTarget={drag.handleCardDragOverTarget}
								onColumnDragStart={drag.handleColumnDragStart}
								onColumnDragEnd={drag.clearDragState}
								onColumnReorderDragOver={drag.handleColumnReorderDragOver}
								onColumnReorderDrop={drag.handleColumnReorderDrop}
							/>
						</div>
					))}

					{drag.draggingColumnId && drag.projectedColumnDropId === null ? (
						<ColumnDropIndicator />
					) : null}

					<div className="flex w-[4.5rem] shrink-0 self-start flex-col items-end px-0 py-1">
						<div aria-hidden="true" className="h-[2.35rem]" />
						<div className="mt-2.5 flex w-full items-start justify-end">
							<button
								type="button"
								onClick={state.handleAddColumn}
								className="inline-flex h-[9.75rem] w-[3.75rem] shrink-0 flex-col items-center justify-center gap-2.5 border border-dashed px-1.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors"
								style={{
									borderRadius: `${Math.max(controlRadius, 0)}px`,
									borderColor:
										'color-mix(in srgb, var(--color-accent-border) 34%, var(--color-border))',
									backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 72%, white)',
									backgroundImage: 'var(--kanban-sketch-control-texture)',
									color:
										'color-mix(in srgb, var(--color-accent-text) 24%, var(--color-text-secondary))',
									boxShadow: 'var(--kanban-sketch-control-shadow)',
								}}
								onDragOver={drag.handleColumnDropAtEnd}
								onDrop={(event) => {
									if (!drag.draggingColumnId) return;
									drag.handleColumnReorderDrop(event);
								}}
								title="Add column"
							>
								<PlusIcon />
								<span
									style={{
										writingMode: 'vertical-rl',
										textOrientation: 'mixed',
										letterSpacing: '0.24em',
									}}
								>
									Add
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			{state.showSettings ? (
				<KanbanBoardSettingsPanel
					settingsRef={settingsRef}
					activeFontId={activeFont.id}
					fontSize={fontSize}
					onSelectFont={state.handleSetFont}
					onAdjustFontSize={state.handleAdjustFontSize}
					onResetBoard={state.handleResetBoard}
				/>
			) : null}

			{drag.draggingCardId ? (
				<KanbanDeleteDropZone
					isDeleteTargeted={drag.isDeleteTargeted}
					onDragOver={drag.handleDeleteDragOver}
					onDrop={drag.handleDeleteDrop}
				/>
			) : null}

			{state.pendingDeleteColumn ? (
				<KanbanDeleteColumnDialog
					columnTitle={state.pendingDeleteColumn.title}
					cardCount={state.pendingDeleteColumn.cards.length}
					onCancel={() => state.setPendingDeleteColumnId(null)}
					onConfirm={state.handleDeletePendingColumn}
				/>
			) : null}
		</OverlaySurface>
	);
}
