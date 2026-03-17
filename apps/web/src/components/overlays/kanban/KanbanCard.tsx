import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import { memo, useEffect, useRef, useState } from 'react';
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
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [titleDraft, setTitleDraft] = useState(card.title);
	const dragArmedRef = useRef(false);
	const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const titleDraftRef = useRef(titleDraft);
	const cardTitleRef = useRef(card.title);

	useEffect(() => {
		setDetailsOpen(false);
		setIsEditingDescription(false);
		cardTitleRef.current = card.title;
		setTitleDraft(card.title);
	}, [card.id]);

	useEffect(() => {
		cardTitleRef.current = card.title;
		setTitleDraft(card.title);
	}, [card.title]);

	useEffect(() => {
		titleDraftRef.current = titleDraft;
	}, [titleDraft]);

	useEffect(() => {
		if (!titleTextareaRef.current) return;
		autosizeTextarea(titleTextareaRef.current);
	}, [fontSize, titleDraft]);

	useEffect(() => {
		if (!descriptionTextareaRef.current) return;
		autosizeTextarea(descriptionTextareaRef.current);
		if (!isEditingDescription) return;
		descriptionTextareaRef.current.focus();
		const end = descriptionTextareaRef.current.value.length;
		descriptionTextareaRef.current.setSelectionRange(end, end);
	}, [card.description, fontSize, isEditingDescription]);

	const commitTitleDraft = () => {
		const nextTitle = titleDraftRef.current;
		const currentTitle = cardTitleRef.current;
		if (nextTitle.trim().length === 0) {
			setTitleDraft(card.title);
			return;
		}
		if (nextTitle === currentTitle) return;
		onChange({ title: nextTitle });
	};

	useEffect(
		() => () => {
			const nextTitle = titleDraftRef.current;
			const currentTitle = cardTitleRef.current;
			if (nextTitle.trim().length === 0 || nextTitle === currentTitle) return;
			onChange({ title: nextTitle });
		},
		[onChange],
	);

	const handleTitleInput = (event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	};

	const handleDescriptionInput = (event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	};

	const handleDragHandleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
		dragArmedRef.current = true;
		event.stopPropagation();
	};

	return (
		<div
			draggable
			onDragStart={(event) => {
				if (!dragArmedRef.current) {
					event.preventDefault();
					return;
				}
				onDragStart(event);
			}}
			onDragEnd={() => {
				dragArmedRef.current = false;
				onDragEnd();
			}}
			onDragOver={onDragOverCard}
			onMouseUp={() => {
				dragArmedRef.current = false;
			}}
			onMouseDown={(event) => event.stopPropagation()}
			onMouseEnter={() => {
				setIsHovered(true);
				onHoverChange?.(true);
			}}
			onMouseLeave={() => {
				setIsHovered(false);
				onHoverChange?.(false);
			}}
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
					onTitleTextareaRef={(node) => {
						titleTextareaRef.current = node;
					}}
					onDescriptionTextareaRef={(node) => {
						descriptionTextareaRef.current = node;
					}}
					isEditingDescription={isEditingDescription}
					onDescriptionEditingChange={setIsEditingDescription}
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
