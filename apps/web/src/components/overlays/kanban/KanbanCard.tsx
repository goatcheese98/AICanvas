import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
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
	isDragging: boolean;
	showReturnCue: boolean;
	onChange: (updates: Partial<KanbanCardType>) => void;
	onDelete: () => void;
	onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
	onDragEnd: () => void;
	onDragOverCard: (event: DragEvent<HTMLDivElement>) => void;
}

const PRIORITY_META = {
	low: {
		label: 'Low',
		background: 'var(--color-success-bg)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 18%, transparent)',
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
			className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
			aria-hidden="true"
		>
			<path d="m5.5 7.5 4.5 5 4.5-5" />
		</svg>
	);
}

export function KanbanCard({
	card,
	fontSize = 14,
	cardBackground,
	isDragging,
	showReturnCue,
	onChange,
	onDelete,
	onDragStart,
	onDragEnd,
	onDragOverCard,
}: KanbanCardProps) {
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		setDetailsOpen(false);
		setIsEditingDescription(false);
	}, [card.id]);

	useEffect(() => {
		if (!isEditingDescription) return;
		const target = descriptionTextareaRef.current;
		if (!target) return;
		target.focus();
		const end = target.value.length;
		target.setSelectionRange(end, end);
	}, [isEditingDescription]);

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

	const openDescriptionEditor = () => {
		setIsEditingDescription(true);
	};

	return (
		<div
			onDragOver={onDragOverCard}
			className="group relative rounded-[20px] border p-4 transition-all"
			style={{
				borderColor: showReturnCue ? KANBAN_ACCENT_BORDER : 'var(--color-border)',
				background: cardBackground,
				boxShadow: showReturnCue
					? '0 0 0 2px color-mix(in srgb, var(--color-accent-border) 42%, transparent), 0 18px 38px -26px rgba(15,23,42,0.35)'
					: '0 16px 34px -26px rgba(15,23,42,0.18)',
				opacity: isDragging && !showReturnCue ? 0.56 : 1,
			}}
		>
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<div
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ background: priorityMeta.color }}
						/>
						<input
							value={card.title}
							onChange={(event) => onChange({ title: event.target.value })}
							className="w-full border-0 bg-transparent px-0 py-0.5 font-semibold outline-none"
							style={{
								fontSize: `${fontSize}px`,
								color: 'var(--color-text-primary)',
								fontFamily: 'inherit',
							}}
							placeholder="Card title"
						/>
					</div>
				</div>

				<div
					className={`flex shrink-0 items-center gap-1.5 transition-opacity ${
						detailsOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
					}`}
				>
					<button
						type="button"
						draggable
						onDragStart={onDragStart}
						onDragEnd={onDragEnd}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)',
							color: 'var(--color-text-tertiary)',
							cursor: 'grab',
						}}
						aria-label={`Drag ${card.title}`}
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
					</button>

					<button
						type="button"
						onClick={onDelete}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)',
							color: 'var(--color-text-tertiary)',
						}}
						aria-label={`Delete ${card.title}`}
						title="Delete card"
					>
						×
					</button>
				</div>
			</div>

			<div
				className="mt-2 cursor-text"
				onDoubleClick={openDescriptionEditor}
				title="Double-click to edit description"
			>
				{isEditingDescription ? (
					<textarea
						ref={descriptionTextareaRef}
						value={card.description ?? ''}
						onChange={(event) => onChange({ description: event.target.value })}
						onBlur={() => setIsEditingDescription(false)}
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								event.currentTarget.blur();
							}
							if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
								event.currentTarget.blur();
							}
						}}
						className="min-h-[5rem] w-full resize-y rounded-[12px] border px-3 py-2 text-xs outline-none"
						style={{
							borderColor: KANBAN_ACCENT_BORDER,
							background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
							fontSize: `${Math.max(fontSize - 1, 12)}px`,
							fontFamily: 'inherit',
							color: 'var(--color-text-primary)',
						}}
						placeholder="Write the card details"
					/>
				) : card.description?.trim() ? (
					<p
						className="text-xs leading-6"
						onDoubleClick={openDescriptionEditor}
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
						onDoubleClick={openDescriptionEditor}
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
						className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
						style={{
							borderColor: priorityMeta.borderColor,
							background: priorityMeta.background,
							color: priorityMeta.color,
						}}
					>
						{priorityMeta.label}
					</span>

					{card.dueDate ? (
						<span
							className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
							style={{
								borderColor: isOverdue ? 'var(--color-danger-border)' : 'var(--color-border)',
								background: isOverdue
									? 'color-mix(in srgb, var(--color-danger-bg) 82%, white)'
									: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)',
								color: isOverdue ? 'var(--color-danger-text)' : 'var(--color-text-secondary)',
							}}
						>
							{isOverdue ? 'Overdue' : 'Due'} {formatDueDate(card.dueDate)}
						</span>
					) : null}

					{checklist.length ? (
						<span
							className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
							style={{
								borderColor: 'var(--color-border)',
								background: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)',
								color: 'var(--color-text-secondary)',
							}}
						>
							{doneCount}/{checklist.length} checklist
						</span>
					) : null}

					{(card.labels ?? []).slice(0, detailsOpen ? undefined : 2).map((label) => {
						const tone = getLabelTone(label);
						return (
							<span
								key={label}
								className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
								style={tone}
							>
								{label}
							</span>
						);
					})}

					{!detailsOpen && (card.labels?.length ?? 0) > 2 ? (
						<span
							className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
							style={{
								borderColor: 'var(--color-border)',
								background: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)',
								color: 'var(--color-text-secondary)',
							}}
						>
							+{(card.labels?.length ?? 0) - 2}
						</span>
					) : null}
				</div>

				{checklist.length ? (
					<div className="mt-3">
						<div
							className="h-1.5 overflow-hidden rounded-full"
							style={{ background: 'color-mix(in srgb, var(--color-surface-muted) 92%, white)' }}
						>
							<div
								className="h-full rounded-full transition-[width]"
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
				style={{ background: 'color-mix(in srgb, var(--color-border) 86%, transparent)' }}
			/>

			<button
				type="button"
				onClick={() => setDetailsOpen((current) => !current)}
				className="mt-3 inline-flex w-full items-center justify-between rounded-[12px] px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
				style={{
					color: detailsOpen ? KANBAN_ACCENT_TEXT : 'var(--color-text-secondary)',
				}}
			>
				<span>Details</span>
				<ChevronIcon open={detailsOpen} />
			</button>

				{detailsOpen ? (
					<div
						className="mt-3 space-y-4 rounded-[16px] border p-4"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-muted) 86%, white)',
						}}
					>
						<div className="grid gap-3">
							<div className="grid grid-cols-2 gap-3">
								<label className="block">
									<div
										className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
										style={{ color: 'var(--color-text-tertiary)' }}
									>
										Due date
									</div>
									<input
										type="date"
										value={card.dueDate ?? ''}
										onChange={(event) => onChange({ dueDate: event.target.value || undefined })}
										className="w-full rounded-[12px] border px-3 py-2 text-xs outline-none"
										style={{
											borderColor: 'var(--color-border)',
											background: 'var(--color-surface-strong)',
											color: 'var(--color-text-primary)',
											fontFamily: 'inherit',
										}}
									/>
								</label>

								<label className="block">
									<div
										className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
										style={{ color: 'var(--color-text-tertiary)' }}
									>
										Labels
									</div>
									<input
										value={labelValue}
										onChange={(event) => onChange({ labels: parseLabelInput(event.target.value) })}
										className="w-full rounded-[12px] border px-3 py-2 text-xs outline-none"
										style={{
											borderColor: 'var(--color-border)',
											background: 'var(--color-surface-strong)',
											color: 'var(--color-text-primary)',
											fontFamily: 'inherit',
										}}
										placeholder="design, research, launch"
									/>
								</label>
							</div>

							<div>
								<div
									className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
									style={{ color: 'var(--color-text-tertiary)' }}
								>
									Priority
								</div>
								<div className="flex items-center gap-1.5 overflow-x-auto pb-1 whitespace-nowrap">
									{(Object.keys(PRIORITY_META) as Array<keyof typeof PRIORITY_META>).map((option) => {
										const meta = PRIORITY_META[option];
										const isActive = option === priority;
										return (
											<button
												key={option}
												type="button"
												onClick={() => onChange({ priority: option })}
												className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors"
												style={{
													borderColor: isActive ? meta.borderColor : 'var(--color-border)',
													background: isActive
														? meta.background
														: 'color-mix(in srgb, var(--color-surface-strong) 92%, white)',
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
										className="inline-flex items-center rounded-[10px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
										style={{
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
											<div key={`${card.id}-check-${index}`} className="flex items-center gap-2">
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
													className="min-w-0 flex-1 rounded-[12px] border px-3 py-2 text-xs outline-none"
													style={{
														borderColor: 'var(--color-border)',
														background: 'var(--color-surface-strong)',
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
													className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border"
													style={{
														borderColor: 'var(--color-border)',
														background: 'var(--color-surface-strong)',
														color: 'var(--color-text-tertiary)',
													}}
													aria-label="Delete checklist item"
												>
													×
												</button>
											</div>
										))
									) : (
										<div
											className="rounded-[12px] border border-dashed px-3 py-3 text-xs"
											style={{
												borderColor: 'var(--color-border)',
												color: 'var(--color-text-tertiary)',
												background: 'color-mix(in srgb, var(--color-surface-strong) 76%, white)',
											}}
										>
											Add a checklist when the card needs a sequence.
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				) : null}
		</div>
	);
}
