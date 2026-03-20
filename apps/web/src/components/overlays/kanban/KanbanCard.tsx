import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import { useMountEffect } from '@/hooks/useMountEffect';
import { memo, useCallback, useRef, useState } from 'react';
import type { DragEvent, FormEvent, MouseEvent } from 'react';
import { KanbanCardDetails } from './KanbanCardDetails';
import { KanbanCardShell } from './KanbanCardShell';
import { KanbanCardSummary } from './KanbanCardSummary';
import { autosizeTextarea } from './kanban-card-helpers';

interface KanbanCardProps {
	card: KanbanCardType;
	fontSize?: number;
	cardBackground: string;
	cardRadius: number;
	controlRadius: number;
	isLiveResizing: boolean;
	isDragging: boolean;
	showReturnCue: boolean;
	onChange: (updates: Partial<KanbanCardType>) => void;
	onDelete: () => void;
	onDragStart: (event: DragEvent<HTMLElement>) => void;
	onDragEnd: () => void;
	onDragOverCard: (event: DragEvent<HTMLDivElement>) => void;
	onHoverChange?: (hovered: boolean) => void;
}

function KanbanCardInner({
	card,
	fontSize = 14,
	cardBackground,
	cardRadius,
	controlRadius,
	isLiveResizing,
	isDragging,
	showReturnCue,
	onChange,
	onDelete,
	onDragStart,
	onDragEnd,
	onDragOverCard,
	onHoverChange,
}: KanbanCardProps) {
	// State for UI interactions - reset when card changes via key prop
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [isHovered, setIsHovered] = useState(false);

	// Refs for DOM interactions
	const dragArmedRef = useRef(false);
	const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const cardTitleRef = useRef(card.title);
	const titleDraftRef = useRef(card.title);

	// Local state for title draft - initialized from card.title
	// Parent should use key={card.id} to reset this when card changes
	const [titleDraft, setTitleDraft] = useState(card.title);

	// Keep refs in sync
	titleDraftRef.current = titleDraft;

	// Sync with card.title when it changes externally and not being edited
	if (card.title !== cardTitleRef.current) {
		cardTitleRef.current = card.title;
		// Only update draft if title textarea is not focused
		if (document.activeElement !== titleTextareaRef.current) {
			setTitleDraft(card.title);
		}
	}

	// Commit title changes to parent
	const commitTitleDraft = useCallback(() => {
		const nextTitle = titleDraftRef.current.trim();
		if (nextTitle.length === 0) {
			setTitleDraft(card.title);
			return;
		}
		if (nextTitle === card.title) return;
		onChange({ title: nextTitle });
	}, [card.title, onChange]);

	useMountEffect(() => {
		return () => {
			const nextTitle = titleDraftRef.current.trim();
			const currentTitle = cardTitleRef.current;
			if (nextTitle.length === 0 || nextTitle === currentTitle) {
				return;
			}
			onChange({ title: nextTitle });
		};
	});

	// Handle title textarea input with autosizing
	const handleTitleInput = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	}, []);

	// Handle description textarea input with autosizing
	const handleDescriptionInput = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	}, []);

	// Handle description editing state change with focus management
	const handleDescriptionEditingChange = useCallback((editing: boolean) => {
		setIsEditingDescription(editing);
		if (editing) {
			// Use requestAnimationFrame for focus after render
			requestAnimationFrame(() => {
				const textarea = descriptionTextareaRef.current;
				if (textarea) {
					textarea.focus();
					const end = textarea.value.length;
					textarea.setSelectionRange(end, end);
				}
			});
		}
	}, []);

	// Handle drag handle mouse down
	const handleDragHandleMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		dragArmedRef.current = true;
		event.stopPropagation();
	}, []);

	// Handle title textarea ref callback with autosizing
	const handleTitleTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
		titleTextareaRef.current = node;
		if (node) {
			autosizeTextarea(node);
		}
	}, []);

	// Handle description textarea ref callback
	const handleDescriptionTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
		descriptionTextareaRef.current = node;
	}, []);

	// Handle drag start
	const handleDragStart = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!dragArmedRef.current) {
				event.preventDefault();
				return;
			}
			onDragStart(event);
		},
		[onDragStart],
	);

	// Handle drag end
	const handleDragEnd = useCallback(() => {
		dragArmedRef.current = false;
		onDragEnd();
	}, [onDragEnd]);

	// Handle mouse enter/leave
	const handleMouseEnter = useCallback(() => {
		setIsHovered(true);
		onHoverChange?.(true);
	}, [onHoverChange]);

	const handleMouseLeave = useCallback(() => {
		setIsHovered(false);
		onHoverChange?.(false);
	}, [onHoverChange]);

	// Handle mouse up
	const handleMouseUp = useCallback(() => {
		dragArmedRef.current = false;
	}, []);

	// Handle mouse down on card (prevent propagation)
	const handleMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	return (
		<div
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragOver={onDragOverCard}
			onMouseUp={handleMouseUp}
			onMouseDown={handleMouseDown}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			className="group relative border px-4 py-4 transition-[transform,box-shadow,border-color,opacity]"
			style={{
				minHeight: 'var(--kanban-card-min-height, 156px)',
				overflow: 'visible',
				borderRadius: `${cardRadius}px`,
				borderColor: showReturnCue
					? 'color-mix(in srgb, var(--color-accent-border) 34%, var(--color-border))'
					: 'color-mix(in srgb, var(--color-text-secondary) 14%, var(--color-border))',
				backgroundColor: cardBackground,
				backgroundImage: 'var(--kanban-sketch-card-texture)',
				boxShadow: showReturnCue
					? '0 0 0 3px color-mix(in srgb, var(--color-accent-bg) 64%, transparent), 0 18px 34px -26px rgba(15,23,42,0.34)'
					: '0 18px 34px -30px rgba(15,23,42,0.22), var(--kanban-sketch-card-shadow)',
				opacity: isDragging && !showReturnCue ? 0.48 : 1,
				transform: showReturnCue ? 'translateY(-1px)' : 'translateY(0)',
				transitionDuration: 'var(--kanban-motion-duration)',
			}}
		>
			<KanbanCardShell
				cardRadius={cardRadius}
				isLiveResizing={isLiveResizing}
				showReturnCue={showReturnCue}
			>
				<KanbanCardSummary
					card={card}
					titleDraft={titleDraft}
					fontSize={fontSize}
					controlRadius={controlRadius}
					detailsOpen={detailsOpen}
					isHovered={isHovered}
					isDragging={isDragging}
					onToggleDetails={() => setDetailsOpen((current) => !current)}
					onDelete={onDelete}
					onTitleDraftChange={setTitleDraft}
					onTitleBlur={commitTitleDraft}
					onTitleInput={handleTitleInput}
					onTitleTextareaRef={handleTitleTextareaRef}
					onDescriptionTextareaRef={handleDescriptionTextareaRef}
					isEditingDescription={isEditingDescription}
					onDescriptionEditingChange={handleDescriptionEditingChange}
					onDescriptionChange={(value) => onChange({ description: value })}
					onDescriptionInput={handleDescriptionInput}
					onDragHandleMouseDown={handleDragHandleMouseDown}
				/>
				{detailsOpen ? (
					<KanbanCardDetails
						card={card}
						cardRadius={cardRadius}
						controlRadius={controlRadius}
						onChange={onChange}
					/>
				) : null}
			</KanbanCardShell>
		</div>
	);
}

export const KanbanCard = memo(KanbanCardInner, (prev, next) => {
	return (
		prev.card === next.card &&
		prev.isLiveResizing === next.isLiveResizing &&
		prev.isDragging === next.isDragging &&
		prev.showReturnCue === next.showReturnCue &&
		prev.fontSize === next.fontSize &&
		prev.cardBackground === next.cardBackground &&
		prev.cardRadius === next.cardRadius &&
		prev.controlRadius === next.controlRadius
	);
});
