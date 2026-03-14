import type { FormEvent, MouseEvent } from 'react';
import type { KanbanCard as KanbanCardType } from '@ai-canvas/shared/types';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_TEXT,
	formatDueDate,
	isKanbanCardOverdue,
} from './kanban-theme';
import { getLabelTone } from './kanban-card-helpers';

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

interface KanbanCardSummaryProps {
	card: KanbanCardType;
	titleDraft: string;
	fontSize: number;
	controlRadius: number;
	detailsOpen: boolean;
	isHovered: boolean;
	isDragging: boolean;
	onToggleDetails: () => void;
	onDelete: () => void;
	onTitleDraftChange: (value: string) => void;
	onTitleBlur: () => void;
	onTitleInput: (event: FormEvent<HTMLTextAreaElement>) => void;
	onTitleTextareaRef: (node: HTMLTextAreaElement | null) => void;
	onDescriptionTextareaRef: (node: HTMLTextAreaElement | null) => void;
	isEditingDescription: boolean;
	onDescriptionEditingChange: (editing: boolean) => void;
	onDescriptionChange: (value: string) => void;
	onDescriptionInput: (event: FormEvent<HTMLTextAreaElement>) => void;
	onDragHandleMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
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

export function KanbanCardSummary({
	card,
	titleDraft,
	fontSize,
	controlRadius,
	detailsOpen,
	isHovered,
	isDragging,
	onToggleDetails,
	onDelete,
	onTitleDraftChange,
	onTitleBlur,
	onTitleInput,
	onTitleTextareaRef,
	onDescriptionTextareaRef,
	isEditingDescription,
	onDescriptionEditingChange,
	onDescriptionChange,
	onDescriptionInput,
	onDragHandleMouseDown,
}: KanbanCardSummaryProps) {
	const checklist = card.checklist ?? [];
	const doneCount = checklist.filter((item) => item.done).length;
	const checklistProgress = checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0;
	const isOverdue = isKanbanCardOverdue(card.dueDate);
	const priority = card.priority ?? 'medium';
	const priorityMeta = PRIORITY_META[priority];

	return (
		<>
			<div className="flex items-start gap-2">
				<div
					className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: priorityMeta.color }}
				/>
				<textarea
					ref={onTitleTextareaRef}
					rows={1}
					value={titleDraft}
					onChange={(event) => onTitleDraftChange(event.target.value)}
					onBlur={onTitleBlur}
					onInput={onTitleInput}
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
				onDoubleClick={() => onDescriptionEditingChange(true)}
				title="Double-click to edit description"
			>
				{isEditingDescription ? (
					<textarea
						ref={onDescriptionTextareaRef}
						rows={3}
						value={card.description ?? ''}
						onChange={(event) => onDescriptionChange(event.target.value)}
						onInput={onDescriptionInput}
						onBlur={() => onDescriptionEditingChange(false)}
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
				<div className="mt-3 space-y-1.5">
					{checklist.map((item, index) => (
						<label
							key={`${card.id}-check-inline-${index}`}
							className="flex cursor-pointer items-start gap-2 rounded-[10px] px-2 py-1.5 transition-colors"
							style={{
								background: item.done
									? 'color-mix(in srgb, var(--color-success-bg) 52%, transparent)'
									: 'color-mix(in srgb, var(--color-surface-strong) 58%, transparent)',
							}}
						>
							<input type="checkbox" checked={item.done} readOnly className="sr-only" />
							<span
								className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
								style={{
									color: item.done ? 'var(--color-success-text)' : 'var(--color-text-tertiary)',
								}}
							>
								<ChecklistIcon />
							</span>
							<span
								className="min-w-0 flex-1 text-xs leading-[1.55]"
								style={{
									fontSize: `${Math.max(fontSize - 2, 11)}px`,
									fontFamily: 'inherit',
									color: item.done ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
									textDecoration: item.done ? 'line-through' : 'none',
								}}
							>
								{item.text}
							</span>
						</label>
					))}
				</div>
			) : null}

			{checklist.length ? (
				<div className="mt-3">
					<div
						className="h-1.5 overflow-hidden rounded-full"
						style={{ background: 'color-mix(in srgb, var(--color-surface-muted) 90%, white)' }}
					>
						<div
							className="h-full rounded-full transition-[width]"
							style={{
								width: `${checklistProgress}%`,
								background:
									checklistProgress === 100 ? 'var(--color-success-text)' : priorityMeta.color,
								transitionDuration: 'var(--kanban-motion-duration)',
							}}
						/>
					</div>
				</div>
			) : null}

			<div
				className="mt-4 h-px rounded-full"
				style={{
					backgroundColor: 'color-mix(in srgb, var(--color-border) 88%, transparent)',
					backgroundImage: 'var(--kanban-sketch-divider)',
				}}
			/>

			<div className="mt-3 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={onToggleDetails}
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
					className={`flex shrink-0 items-center gap-1.5 transition-opacity ${
						isHovered || detailsOpen || isDragging ? 'opacity-100' : 'opacity-0'
					}`}
					style={{ transitionDuration: 'var(--kanban-motion-duration-fast)' }}
				>
					<div
						data-card-drag-handle="true"
						role="button"
						tabIndex={0}
						onMouseDown={onDragHandleMouseDown}
						className="inline-flex h-8 w-8 items-center justify-center border transition-colors"
						style={{
							borderRadius: `${Math.max(controlRadius, 0)}px`,
							borderColor: 'color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-border))',
							backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
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
							backgroundColor: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
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
		</>
	);
}
