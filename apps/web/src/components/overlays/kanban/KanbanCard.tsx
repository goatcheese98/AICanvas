import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_TEXT,
	formatDueDate,
	isKanbanCardOverdue,
} from './kanban-theme';

interface KanbanCardProps {
	card: KanbanCardType;
	fontSize?: number;
	cardBackground: string;
	cardRadius: number;
	controlRadius: number;
	isDragging: boolean;
	showReturnCue: boolean;
	onChange: (updates: Partial<KanbanCardType>) => void;
	onDelete: () => void;
	onDragStart: (event: DragEvent<HTMLElement>) => void;
	onDragEnd: () => void;
	onDragOverCard: (event: DragEvent<HTMLDivElement>) => void;
	onHoverChange?: (hovered: boolean) => void;
}

const PRIORITY_META = {
	low: {
		label: 'Low',
		background: 'var(--color-success-bg)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 20%, transparent)',
		color: 'var(--color-success-text)',
	},
	medium: {
		label: 'Medium',
		background: KANBAN_ACCENT_SURFACE,
		borderColor: KANBAN_ACCENT_BORDER,
		color: KANBAN_ACCENT_TEXT,
	},
	high: {
		label: 'High',
		background: 'var(--color-danger-bg)',
		borderColor: 'var(--color-danger-border)',
		color: 'var(--color-danger-text)',
	},
} as const;

const LABEL_TONES = [
	{
		background: 'color-mix(in srgb, var(--color-accent-bg) 82%, white)',
		borderColor: KANBAN_ACCENT_BORDER,
		color: KANBAN_ACCENT_TEXT,
	},
	{
		background: 'color-mix(in srgb, var(--color-success-bg) 88%, white)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 20%, transparent)',
		color: 'var(--color-success-text)',
	},
	{
		background: 'color-mix(in srgb, var(--color-danger-bg) 88%, white)',
		borderColor: 'color-mix(in srgb, var(--color-danger-border) 80%, transparent)',
		color: 'var(--color-danger-text)',
	},
	{
		background: 'color-mix(in srgb, var(--color-warm-bg) 88%, white)',
		borderColor: 'color-mix(in srgb, var(--color-warm-text) 16%, transparent)',
		color: 'var(--color-warm-text)',
	},
];

function parseLabelInput(value: string) {
	return value
		.split(',')
		.map((label) => label.trim())
		.filter(Boolean);
}

function hashString(value: string) {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash);
}

function getLabelTone(label: string) {
	return LABEL_TONES[hashString(label) % LABEL_TONES.length] ?? LABEL_TONES[0];
}

function ChevronIcon({ open }: { open: boolean }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
			aria-hidden="true"
		>
			<path d="m5.5 7.5 4.5 5 4.5-5" />
		</svg>
	);
}

function ChecklistIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-3.5 w-3.5"
			aria-hidden="true"
		>
			<rect x="3.5" y="3.5" width="13" height="13" rx="2.5" />
			<path d="m6.75 10 2 2 4.5-4.5" />
		</svg>
	);
}

function autosizeTextarea(target: HTMLTextAreaElement) {
	target.style.height = '0px';
	target.style.height = `${target.scrollHeight}px`;
}

function KanbanCardInner({
	card,
	fontSize = 14,
	cardBackground,
	cardRadius,
	controlRadius,
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

	useEffect(() => {
		setDetailsOpen(false);
		setIsEditingDescription(false);
		setTitleDraft(card.title);
	}, [card.id]);

	useEffect(() => {
		setTitleDraft(card.title);
	}, [card.title]);

	useEffect(() => {
		if (!titleTextareaRef.current) return;
		autosizeTextarea(titleTextareaRef.current);
	}, [titleDraft, fontSize]);

	useEffect(() => {
		if (!descriptionTextareaRef.current) return;
		autosizeTextarea(descriptionTextareaRef.current);
		if (!isEditingDescription) return;
		descriptionTextareaRef.current.focus();
		const end = descriptionTextareaRef.current.value.length;
		descriptionTextareaRef.current.setSelectionRange(end, end);
	}, [card.description, isEditingDescription, fontSize]);

	const checklist = card.checklist ?? [];
	const doneCount = checklist.filter((item) => item.done).length;
	const checklistProgress = checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0;
	const isOverdue = isKanbanCardOverdue(card.dueDate);
	const labelValue = useMemo(() => (card.labels ?? []).join(', '), [card.labels]);
	const priority = card.priority ?? 'medium';
	const priorityMeta = PRIORITY_META[priority];

	const updateChecklist = (
		updater: (
			current: NonNullable<KanbanCardType['checklist']>,
		) => NonNullable<KanbanCardType['checklist']>,
	) => {
		onChange({ checklist: updater(card.checklist ?? []) });
	};

	const handleTitleInput = (event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	};

	const handleDescriptionInput = (event: FormEvent<HTMLTextAreaElement>) => {
		autosizeTextarea(event.currentTarget);
	};

	const commitTitleDraft = () => {
		if (titleDraft.trim().length === 0) {
			setTitleDraft(card.title);
			return;
		}
		if (titleDraft === card.title) return;
		onChange({ title: titleDraft });
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
			className="group relative border px-4 py-4 transition-[transform,box-shadow,border-color,opacity] duration-200"
			style={{
				borderRadius: `${cardRadius}px`,
				borderColor: showReturnCue
					? KANBAN_ACCENT_BORDER
					: 'color-mix(in srgb, var(--color-text-secondary) 14%, var(--color-border))',
				backgroundColor: cardBackground,
				backgroundImage: 'var(--kanban-sketch-card-texture)',
				boxShadow: showReturnCue
					? '0 0 0 3px color-mix(in srgb, var(--color-accent-bg) 64%, transparent), 0 18px 34px -26px rgba(15,23,42,0.34)'
					: '0 18px 34px -30px rgba(15,23,42,0.22), var(--kanban-sketch-card-shadow)',
				opacity: isDragging && !showReturnCue ? 0.48 : 1,
				transform: showReturnCue ? 'translateY(-1px)' : 'translateY(0)',
			}}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{
					borderRadius: `${cardRadius}px`,
					boxShadow: 'inset 0 0 0 1px var(--kanban-sketch-edge-soft)',
					transform:
						'translate(var(--kanban-sketch-edge-offset), calc(var(--kanban-sketch-edge-offset) * 0.55)) rotate(var(--kanban-sketch-edge-tilt))',
					opacity: 'calc(0.22 + (var(--kanban-sketch-intensity) * 0.55))',
				}}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-[1px]"
				style={{
					borderRadius: `${Math.max(cardRadius - 1, 0)}px`,
					boxShadow: 'inset 0 0 0 1px var(--kanban-sketch-edge-strong)',
					transform:
						'translate(calc(var(--kanban-sketch-edge-offset-alt) * -1), var(--kanban-sketch-edge-offset-alt)) rotate(var(--kanban-sketch-edge-tilt-alt))',
					opacity: 'calc(0.16 + (var(--kanban-sketch-intensity) * 0.48))',
				}}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-[10px] top-[8px] h-[18px]"
				style={{
					borderTop: '1px solid var(--kanban-sketch-edge-soft)',
					borderRadius: `${Math.max(cardRadius - 4, 0)}px`,
					transform: 'rotate(calc(var(--kanban-sketch-edge-tilt) * 0.55))',
					opacity: 'calc(0.12 + (var(--kanban-sketch-intensity) * 0.22))',
				}}
			/>
			<div className="relative z-[1]">
			<div className="flex items-start gap-2">
				<div
					className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: priorityMeta.color }}
				/>
				<textarea
					ref={titleTextareaRef}
					rows={1}
					value={titleDraft}
					onChange={(event) => setTitleDraft(event.target.value)}
					onBlur={commitTitleDraft}
					onInput={handleTitleInput}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							event.currentTarget.blur();
						}
					}}
					maxLength={120}
					className="min-h-[2rem] w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0.5 font-semibold leading-[1.25] outline-none"
					style={{
						fontSize: `${fontSize}px`,
						color: 'var(--color-text-primary)',
						fontFamily: 'inherit',
					}}
					placeholder="Card title"
				/>
			</div>

			<div
				className="mt-2 cursor-text"
				onDoubleClick={() => setIsEditingDescription(true)}
				title="Double-click to edit description"
			>
				{isEditingDescription ? (
					<textarea
						ref={descriptionTextareaRef}
						rows={3}
						value={card.description ?? ''}
						onChange={(event) => onChange({ description: event.target.value })}
						onInput={handleDescriptionInput}
						onBlur={() => setIsEditingDescription(false)}
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								event.currentTarget.blur();
							}
							if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
								event.currentTarget.blur();
							}
						}}
						maxLength={2000}
						className="w-full resize-none overflow-hidden rounded-[12px] border px-3 py-2 text-xs outline-none"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: KANBAN_ACCENT_BORDER,
							background: 'color-mix(in srgb, var(--color-surface-strong) 97%, white)',
							fontSize: `${Math.max(fontSize - 1, 12)}px`,
							fontFamily: 'inherit',
							color: 'var(--color-text-primary)',
							lineHeight: '1.65',
						}}
						placeholder="Write the card details"
					/>
				) : card.description?.trim() ? (
					<p
						className="text-xs leading-[1.75]"
						style={{
							fontSize: `${Math.max(fontSize - 1, 12)}px`,
							fontFamily: 'inherit',
							color: 'var(--color-text-secondary)',
							display: '-webkit-box',
							WebkitBoxOrient: 'vertical',
							WebkitLineClamp: 3,
							overflow: 'hidden',
							whiteSpace: 'pre-wrap',
						}}
					>
						{card.description}
					</p>
				) : (
					<p
						className="text-xs italic"
						style={{
							fontSize: `${Math.max(fontSize - 1, 12)}px`,
							fontFamily: 'inherit',
							color: 'var(--color-text-tertiary)',
						}}
					>
						Double-click to add a description
					</p>
				)}
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<span
					className="border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
					style={{
						borderRadius: `${Math.max(controlRadius, 0)}px`,
						borderColor: priorityMeta.borderColor,
						background: priorityMeta.background,
						color: priorityMeta.color,
					}}
				>
					{priorityMeta.label}
				</span>

				{checklist.length ? (
					<span
						className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
							color: 'var(--color-text-secondary)',
						}}
					>
						<ChecklistIcon />
						<span>
							{doneCount}/{checklist.length}
						</span>
					</span>
				) : null}

				{card.dueDate ? (
					<span
						className="border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: isOverdue ? 'var(--color-danger-border)' : 'var(--color-border)',
							background: isOverdue
								? 'color-mix(in srgb, var(--color-danger-bg) 82%, white)'
								: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
							color: isOverdue ? 'var(--color-danger-text)' : 'var(--color-text-secondary)',
						}}
					>
						{isOverdue ? 'Overdue' : 'Due'} {formatDueDate(card.dueDate)}
					</span>
				) : null}

				{(card.labels ?? []).slice(0, detailsOpen ? undefined : 3).map((label) => {
					const tone = getLabelTone(label);
					return (
						<span
							key={label}
							className="border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
							style={{
								...tone,
								borderRadius: `${Math.max(controlRadius, 0)}px`,
							}}
						>
							{label}
						</span>
					);
				})}

				{!detailsOpen && (card.labels?.length ?? 0) > 3 ? (
					<span
						className="border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
							color: 'var(--color-text-secondary)',
						}}
					>
						+{(card.labels?.length ?? 0) - 3}
					</span>
				) : null}
			</div>

			{checklist.length ? (
				<div className="mt-3">
					<div
						className="h-1.5 overflow-hidden rounded-full"
						style={{ background: 'color-mix(in srgb, var(--color-surface-muted) 90%, white)' }}
					>
						<div
							className="h-full rounded-full transition-[width] duration-200"
							style={{
								width: `${checklistProgress}%`,
								background:
									checklistProgress === 100 ? 'var(--color-success-text)' : priorityMeta.color,
							}}
						/>
					</div>
				</div>
			) : null}

			<div
				className="mt-4 h-px rounded-full"
				style={{
					background: 'color-mix(in srgb, var(--color-border) 88%, transparent)',
					backgroundImage: 'var(--kanban-sketch-divider)',
				}}
			/>

			<div className="mt-3 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => setDetailsOpen((current) => !current)}
					className="inline-flex min-w-0 items-center gap-2 px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
					style={{
						borderRadius: `${Math.max(controlRadius, 0)}px`,
						color: detailsOpen ? KANBAN_ACCENT_TEXT : 'var(--color-text-secondary)',
					}}
				>
					<span>Details</span>
					<ChevronIcon open={detailsOpen} />
				</button>

				<div
					className={`flex shrink-0 items-center gap-1.5 transition-opacity duration-150 ${
						isHovered || detailsOpen || isDragging ? 'opacity-100' : 'opacity-0'
					}`}
				>
					<div
						data-card-drag-handle="true"
						role="button"
						tabIndex={0}
						onMouseDown={(event) => {
							dragArmedRef.current = true;
							event.stopPropagation();
						}}
						className="inline-flex h-8 w-8 items-center justify-center border transition-colors"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-border))',
							background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
							backgroundImage: 'var(--kanban-sketch-control-texture)',
							color: 'var(--color-text-tertiary)',
							cursor: 'grab',
							userSelect: 'none',
							boxShadow: 'var(--kanban-sketch-control-shadow)',
						}}
						aria-label={`Drag ${titleDraft || card.title}`}
						title="Drag card"
					>
						<span className="grid grid-cols-2 gap-[2px]">
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
						onClick={onDelete}
						onMouseDown={(event) => event.stopPropagation()}
						className="inline-flex h-8 w-8 items-center justify-center border transition-colors"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-border))',
							background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
							backgroundImage: 'var(--kanban-sketch-control-texture)',
							color: 'var(--color-text-tertiary)',
							boxShadow: 'var(--kanban-sketch-control-shadow)',
						}}
						aria-label={`Delete ${titleDraft || card.title}`}
						title="Delete card"
					>
						×
					</button>
				</div>
			</div>

			{detailsOpen ? (
				<div
					className="mt-3 border p-4 transition-all duration-200"
					style={{
						borderRadius: `${Math.max(cardRadius - 4, 0)}px`,
						borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
						background: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
						backgroundImage: 'var(--kanban-sketch-card-texture)',
					}}
				>
					<div className="space-y-4">
						<label className="block min-w-0">
							<div
								className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
								style={{ color: 'var(--color-text-tertiary)' }}
							>
								Due date
							</div>
							<input
								type="date"
								value={card.dueDate ?? ''}
								onChange={(event) => onChange({ dueDate: event.target.value || undefined })}
								className="w-full border px-3 py-2 text-xs outline-none"
								style={{
									borderRadius: `${Math.max(controlRadius, 0)}px`,
									borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
									background: 'var(--color-surface-strong)',
									color: 'var(--color-text-primary)',
									fontFamily: 'inherit',
								}}
							/>
						</label>

						<label className="block min-w-0">
							<div
								className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
								style={{ color: 'var(--color-text-tertiary)' }}
							>
								Labels
							</div>
							<input
								value={labelValue}
								onChange={(event) => onChange({ labels: parseLabelInput(event.target.value) })}
								maxLength={200}
								className="w-full border px-3 py-2 text-xs outline-none"
								style={{
									borderRadius: `${Math.max(controlRadius, 0)}px`,
									borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
									background: 'var(--color-surface-strong)',
									color: 'var(--color-text-primary)',
									fontFamily: 'inherit',
								}}
								placeholder="design, research, launch"
							/>
						</label>

						<div>
							<div
								className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
								style={{ color: 'var(--color-text-tertiary)' }}
							>
								Priority
							</div>
							<div className="grid grid-cols-3 gap-2">
								{(Object.keys(PRIORITY_META) as Array<keyof typeof PRIORITY_META>).map((option) => {
									const meta = PRIORITY_META[option];
									const isActive = option === priority;
									return (
										<button
											key={option}
											type="button"
											onClick={() => onChange({ priority: option })}
											className="inline-flex min-w-0 items-center justify-center gap-1.5 border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
											style={{
												borderRadius: `${Math.max(controlRadius, 0)}px`,
												borderColor: isActive ? meta.borderColor : 'var(--color-border)',
												background: isActive
													? meta.background
													: 'color-mix(in srgb, var(--color-surface-strong) 95%, white)',
												color: isActive ? meta.color : 'var(--color-text-secondary)',
											}}
										>
											<span
												className="h-1.5 w-1.5 rounded-full"
												style={{ background: meta.color }}
											/>
											{meta.label}
										</button>
									);
								})}
							</div>
						</div>

						<div>
							<div className="mb-2 flex items-center justify-between gap-2">
								<div
									className="text-[10px] font-semibold uppercase tracking-[0.16em]"
									style={{ color: 'var(--color-text-tertiary)' }}
								>
									Checklist
								</div>
								<button
									type="button"
									onClick={() =>
										updateChecklist((current) => [...current, { text: '', done: false }])
									}
									className="inline-flex items-center border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
									style={{
										borderRadius: `${Math.max(controlRadius, 0)}px`,
										borderColor: KANBAN_ACCENT_BORDER,
										background: KANBAN_ACCENT_SURFACE,
										color: KANBAN_ACCENT_TEXT,
									}}
								>
									Add item
								</button>
							</div>

							<div className="space-y-2">
								{checklist.length ? (
									checklist.map((item, index) => (
										<div
											key={`${card.id}-check-${index}`}
											className="flex items-center gap-2 border px-2.5 py-2"
											style={{
												borderRadius: `${Math.max(controlRadius, 0)}px`,
												borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
												background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
											}}
										>
											<input
												type="checkbox"
												checked={item.done}
												onChange={(event) =>
													updateChecklist((current) =>
														current.map((candidate, candidateIndex) =>
															candidateIndex === index
																? { ...candidate, done: event.target.checked }
																: candidate,
														),
													)
												}
												className="h-4 w-4 rounded border-[var(--color-border)]"
											/>
											<input
												value={item.text}
												onChange={(event) =>
													updateChecklist((current) =>
														current.map((candidate, candidateIndex) =>
															candidateIndex === index
																? { ...candidate, text: event.target.value }
																: candidate,
														),
													)
												}
												maxLength={200}
												className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none"
												style={{
													color: 'var(--color-text-primary)',
													fontFamily: 'inherit',
												}}
												placeholder="Checklist item"
											/>
											<button
												type="button"
												onClick={() =>
													updateChecklist((current) =>
														current.filter((_, candidateIndex) => candidateIndex !== index),
													)
												}
												className="inline-flex h-8 w-8 items-center justify-center border"
												style={{
													borderRadius: `${Math.max(controlRadius, 0)}px`,
													borderColor: 'color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-border))',
													background: 'var(--color-surface-strong)',
													color: 'var(--color-text-tertiary)',
												}}
												aria-label="Delete checklist item"
											>
												×
											</button>
										</div>
									))
								) : null}
								{checklist.length === 0 ? (
									<div
										className="px-1 text-[11px]"
										style={{ color: 'var(--color-text-tertiary)' }}
									>
										Add the first item when this card needs a clear sequence.
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>
			) : null}
			</div>
		</div>
	);
}

export const KanbanCard = memo(KanbanCardInner, (prev, next) => {
	return (
		prev.card === next.card &&
		prev.isDragging === next.isDragging &&
		prev.showReturnCue === next.showReturnCue &&
		prev.fontSize === next.fontSize &&
		prev.cardBackground === next.cardBackground &&
		prev.cardRadius === next.cardRadius &&
		prev.controlRadius === next.controlRadius
	);
});
