// fallow-ignore-file duplicate-exports
import { useMountEffect } from '@/hooks/useMountEffect';
import type {
	KanbanCard as KanbanCardType,
	KanbanColumn as KanbanColumnType,
} from '@ai-canvas/shared/types';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import KanbanCardView from './KanbanCard';
import { KANBAN_ACCENT_BORDER, KANBAN_ACCENT_TEXT } from './kanban-theme';
import { getProjectedOverCardId } from './kanban-utils';

interface KanbanColumnProps {
	column: KanbanColumnType;
	fontSize?: number;
	columnBackground: string;
	cardBackground: string;
	cardRadius: number;
	controlRadius: number;
	columnRadius: number;
	borderTone: string;
	isLiveResizing: boolean;
	isCardOver: boolean;
	draggingCardId: string | null;
	draggingFromColumnId: string | null;
	draggingColumnId: string | null;
	overCardId: string | null;
	searchQuery: string;
	onChange: (updates: Partial<KanbanColumnType>) => void;
	onRequestDelete: () => void;
	onAddCard: () => void;
	onUpdateCard: (cardId: string, updates: Partial<KanbanCardType>) => void;
	onDeleteCard: (cardId: string) => void;
	onCardDragStart: (event: DragEvent<HTMLElement>, cardId: string, columnId: string) => void;
	onCardDragEnd: () => void;
	onCardColumnDragOver: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
	onCardColumnDrop: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
	onCardDragOverTarget: (
		event: DragEvent<HTMLDivElement>,
		columnId: string,
		hoveredCardId: string,
	) => void;
	onColumnDragStart: (event: DragEvent<HTMLElement>, columnId: string) => void;
	onColumnDragEnd: () => void;
	onColumnReorderDragOver: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
	onColumnReorderDrop: (event: DragEvent<HTMLElement>) => void;
}

function CardDropIndicator({ emphasized = false }: { emphasized?: boolean }) {
	return (
		<div className="px-1 py-1.5">
			<div
				className="relative h-3 transition-all duration-150"
				style={{ opacity: emphasized ? 1 : 0.94 }}
			>
				<div
					className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-all duration-150"
					style={{
						background: 'var(--color-accent-text)',
						boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-accent-bg) 58%, transparent)',
					}}
				/>
			</div>
		</div>
	);
}

function matchesSearch(card: KanbanCardType, query: string) {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return true;

	return (
		card.title.toLowerCase().includes(normalized) ||
		(card.description?.toLowerCase().includes(normalized) ?? false) ||
		(card.labels ?? []).some((label) => label.toLowerCase().includes(normalized))
	);
}

function autosizeTextarea(target: HTMLTextAreaElement) {
	target.style.height = '0px';
	target.style.height = `${target.scrollHeight}px`;
}

function KanbanColumnInner({
	column,
	fontSize = 14,
	cardBackground,
	cardRadius,
	controlRadius,
	columnRadius,
	isLiveResizing,
	isCardOver,
	draggingCardId,
	draggingFromColumnId,
	draggingColumnId,
	overCardId,
	searchQuery,
	onChange,
	onRequestDelete,
	onAddCard,
	onUpdateCard,
	onDeleteCard,
	onCardDragStart,
	onCardDragEnd,
	onCardColumnDragOver,
	onCardColumnDrop,
	onCardDragOverTarget,
	onColumnDragStart,
	onColumnDragEnd,
	onColumnReorderDragOver,
	onColumnReorderDrop,
}: KanbanColumnProps) {
	const isColumnDragging = draggingColumnId === column.id;
	const isSearchActive = searchQuery.trim().length > 0;
	const [isColumnHovered, setIsColumnHovered] = useState(false);
	const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
	const [titleDraft, setTitleDraft] = useState(column.title);
	const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const titleDraftRef = useRef(titleDraft);
	const columnTitleRef = useRef(column.title);
	const displayCards = useMemo(
		() => column.cards.filter((card) => matchesSearch(card, searchQuery)),
		[column.cards, searchQuery],
	);
	const projectedCardId = isCardOver && draggingCardId ? (overCardId ?? null) : null;
	const showEndDropIndicator = isCardOver && Boolean(draggingCardId) && projectedCardId === null;

	// Sync refs on every render to ensure unmount cleanup has access to current values
	titleDraftRef.current = titleDraft;
	columnTitleRef.current = column.title;

	// Use state initialization pattern: sync when column title changes from parent
	const prevTitleRef = useRef(column.title);
	if (prevTitleRef.current !== column.title && titleDraft !== column.title) {
		setTitleDraft(column.title);
	}
	prevTitleRef.current = column.title;

	// Handle textarea autosizing and draft update together
	const handleTitleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = event.target.value;
		setTitleDraft(newValue);
		titleDraftRef.current = newValue;
		autosizeTextarea(event.target);
	}, []);

	const handleTitleInput = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	}, []);

	const commitTitleDraft = useCallback(() => {
		const nextTitle = titleDraftRef.current;
		const currentTitle = columnTitleRef.current;
		if (nextTitle.trim().length === 0) {
			setTitleDraft(column.title);
			titleDraftRef.current = column.title;
			if (titleTextareaRef.current) {
				autosizeTextarea(titleTextareaRef.current);
			}
			return;
		}
		if (nextTitle === currentTitle) return;
		onChange({ title: nextTitle });
	}, [column.title, onChange]);

	useMountEffect(() => {
		return () => {
			const nextTitle = titleDraftRef.current.trim();
			const currentTitle = columnTitleRef.current;
			if (nextTitle.length === 0 || nextTitle === currentTitle) {
				return;
			}
			onChange({ title: nextTitle });
		};
	});

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				commitTitleDraft();
				event.currentTarget.blur();
			}
		},
		[commitTitleDraft],
	);

	return (
		<div
			onMouseEnter={() => setIsColumnHovered(true)}
			onMouseLeave={() => {
				setIsColumnHovered(false);
				setHoveredCardId(null);
			}}
			onDragOver={(event) => {
				if (draggingColumnId) {
					onColumnReorderDragOver(event, column.id);
					return;
				}
				onCardColumnDragOver(event, column.id);
			}}
			onDrop={(event) => {
				if (draggingColumnId) {
					onColumnReorderDrop(event);
					return;
				}
				onCardColumnDrop(event, column.id);
			}}
			className="group flex shrink-0 self-start flex-col px-1 py-1 transition-[box-shadow,border-color,transform,opacity,background-color]"
			style={{
				width: 'var(--kanban-column-width, 320px)',
				borderRadius: `${columnRadius}px`,
				borderColor: isCardOver ? KANBAN_ACCENT_BORDER : 'transparent',
				background: isCardOver
					? 'color-mix(in srgb, var(--color-accent-bg) 16%, transparent)'
					: 'transparent',
				boxShadow: isCardOver
					? 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent-border) 36%, transparent), 0 18px 38px -32px rgba(15,23,42,0.12)'
					: 'none',
				opacity: isColumnDragging ? 0.7 : 1,
				transform: isCardOver ? 'translateY(-1px)' : 'translateY(0)',
				transitionDuration: 'var(--kanban-motion-duration)',
			}}
		>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-0">
				<div className="flex h-8 min-w-0 items-center pr-1.5">
					<textarea
						ref={titleTextareaRef}
						rows={1}
						value={titleDraft}
						onChange={handleTitleChange}
						onBlur={commitTitleDraft}
						onInput={handleTitleInput}
						onKeyDown={handleKeyDown}
						maxLength={80}
						className="h-8 min-h-0 w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-[2px] text-left font-semibold uppercase leading-none outline-none"
						style={{
							color: 'var(--color-text-secondary)',
							fontFamily: 'inherit',
							fontSize: `${Math.max(fontSize + 1, 15)}px`,
							letterSpacing: '0.14em',
						}}
						placeholder="Column title"
					/>
				</div>

				<div
					className={`mt-[2px] flex shrink-0 items-center justify-end gap-1 transition-opacity duration-150 ${
						isColumnHovered && hoveredCardId === null
							? 'pointer-events-auto opacity-100'
							: 'pointer-events-none opacity-0'
					}`}
				>
					<div
						role="button"
						tabIndex={0}
						draggable
						onDragStart={(event) => onColumnDragStart(event, column.id)}
						onDragEnd={onColumnDragEnd}
						className="inline-flex h-7 w-7 items-center justify-center border transition-colors"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor:
								'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
							backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 88%, white)',
							backgroundImage: 'var(--kanban-sketch-control-texture)',
							color: 'var(--color-text-tertiary)',
							cursor: 'grab',
							boxShadow: 'var(--kanban-sketch-control-shadow)',
						}}
						aria-label={`Drag ${titleDraft || column.title}`}
						title="Drag column"
					>
						<span className="grid grid-cols-2 gap-[1.5px]">
							{Array.from({ length: 6 }, (_, index) => (
								<span
									key={index}
									className="h-[3px] w-[3px] rounded-full"
									style={{ background: 'currentColor' }}
								/>
							))}
						</span>
					</div>

					<button
						type="button"
						onClick={onRequestDelete}
						className="inline-flex h-7 w-7 items-center justify-center border text-[15px] leading-none transition-colors"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor:
								'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
							backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 88%, white)',
							backgroundImage: 'var(--kanban-sketch-control-texture)',
							color: 'var(--color-text-tertiary)',
							boxShadow: 'var(--kanban-sketch-control-shadow)',
						}}
						aria-label={`Delete ${titleDraft || column.title}`}
						title="Delete column"
					>
						×
					</button>
				</div>
			</div>

			<div className="mt-2.5 min-h-[8rem] space-y-2">
				{displayCards.map((card) => {
					const showDropBefore =
						isCardOver && Boolean(draggingCardId) && projectedCardId === card.id;
					const showReturnCue =
						Boolean(draggingCardId) &&
						draggingFromColumnId === column.id &&
						projectedCardId === getProjectedOverCardId(column.cards, card.id, false);

					return (
						<div key={card.id}>
							{showDropBefore ? <CardDropIndicator emphasized /> : null}
							<KanbanCardView
								card={card}
								fontSize={fontSize}
								cardBackground={cardBackground}
								cardRadius={cardRadius}
								controlRadius={controlRadius}
								isLiveResizing={isLiveResizing}
								isDragging={draggingCardId === card.id}
								showReturnCue={showReturnCue}
								onChange={(updates) => onUpdateCard(card.id, updates)}
								onDelete={() => onDeleteCard(card.id)}
								onDragStart={(event) => {
									if (isSearchActive) return;
									onCardDragStart(event, card.id, column.id);
								}}
								onDragEnd={onCardDragEnd}
								onDragOverCard={(event) => {
									if (isSearchActive) return;
									onCardDragOverTarget(event, column.id, card.id);
								}}
								onHoverChange={(hovered) => setHoveredCardId(hovered ? card.id : null)}
							/>
						</div>
					);
				})}

				{isSearchActive && displayCards.length === 0 ? (
					<div
						className="rounded-[14px] border border-dashed px-3 py-4 text-center text-[11px] font-medium"
						style={{
							borderColor:
								'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
							color: 'var(--color-text-tertiary)',
							background: 'color-mix(in srgb, var(--color-surface-strong) 92%, white)',
						}}
					>
						No matches
					</div>
				) : null}

				{showEndDropIndicator ? <CardDropIndicator emphasized /> : null}
			</div>

			<button
				type="button"
				onClick={onAddCard}
				className={`mt-4 inline-flex w-full items-center justify-center gap-2 border border-dashed px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-[opacity,transform,colors] ${
					isColumnHovered || isCardOver
						? 'pointer-events-auto translate-y-0 opacity-100'
						: 'pointer-events-none translate-y-1 opacity-0'
				}`}
				style={{
					borderRadius: `${Math.max(cardRadius, 0)}px`,
					borderColor: KANBAN_ACCENT_BORDER,
					backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 86%, white)',
					backgroundImage: 'var(--kanban-sketch-control-texture)',
					color: KANBAN_ACCENT_TEXT,
					boxShadow: '0 12px 28px -26px rgba(15,23,42,0.4)',
					transitionDuration: 'var(--kanban-motion-duration-fast)',
				}}
			>
				<span className="text-sm leading-none">+</span>
				Add card
			</button>

			<div
				className={`mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] transition-opacity ${
					isColumnHovered || isSearchActive ? 'opacity-100' : 'opacity-0'
				}`}
				style={{
					color: 'var(--color-text-tertiary)',
					transitionDuration: 'var(--kanban-motion-duration-fast)',
				}}
			>
				{isSearchActive
					? `${displayCards.length} shown / ${column.cards.length} cards`
					: `${column.cards.length} card${column.cards.length === 1 ? '' : 's'}`}
			</div>
		</div>
	);
}

const KanbanColumnView = memo(KanbanColumnInner);

export default KanbanColumnView;
