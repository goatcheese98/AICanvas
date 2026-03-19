import { getExcalidrawSurfaceStyle } from '@/components/canvas/excalidraw-element-style';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { useMemo } from 'react';
import { KanbanBoardContainer } from './KanbanBoardContainer';
import type { KanbanBoardProps } from './kanban-board-types';
import { getLabelTone } from './kanban-card-helpers';
import {
	KANBAN_ACCENT_BORDER,
	KANBAN_ACCENT_SURFACE,
	KANBAN_ACCENT_TEXT,
	clampKanbanFontSize,
	formatDueDate,
	getKanbanBackgroundTheme,
	getKanbanFontOption,
	isKanbanCardOverdue,
} from './kanban-theme';
import { normalizeKanbanBoard } from './kanban-utils';

const PREVIEW_PRIORITY_META = {
	low: {
		background: 'var(--color-success-bg)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 20%, transparent)',
		color: 'var(--color-success-text)',
	},
	medium: {
		background: KANBAN_ACCENT_SURFACE,
		borderColor: KANBAN_ACCENT_BORDER,
		color: KANBAN_ACCENT_TEXT,
	},
	high: {
		background: 'var(--color-danger-bg)',
		borderColor: 'var(--color-danger-border)',
		color: 'var(--color-danger-text)',
	},
} as const;

function KanbanPreviewBoard({
	element,
	isSelected,
}: Pick<KanbanBoardProps, 'element' | 'isSelected'>) {
	const board = useMemo(() => normalizeKanbanBoard(element.customData), [element.customData]);
	const activeTheme = getKanbanBackgroundTheme(board.bgTheme);
	const activeFont = getKanbanFontOption(board.fontId);
	const fontSize = clampKanbanFontSize(board.fontSize);
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
	const cardCount = board.columns.reduce((total, column) => total + column.cards.length, 0);
	const overdueCount = board.columns.reduce(
		(total, column) =>
			total +
			column.cards.filter((card) => {
				if (!card.dueDate) return false;
				const parsed = new Date(`${card.dueDate}T23:59:59`);
				return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
			}).length,
		0,
	);

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			inheritFillStyle={false}
			className="flex h-full flex-col"
			style={{
				fontFamily: activeFont.family,
				backgroundColor: boardFillSurface.backgroundColor,
				backgroundImage: boardFillSurface.backgroundImage,
			}}
		>
			<div className="flex h-full flex-col bg-white/42 backdrop-blur-[1px]">
				<div className="flex min-h-16 items-center justify-between gap-3 border-b border-stone-200/80 px-5 py-3">
					<div className="min-w-0">
						<div
							className="truncate font-semibold text-stone-900"
							style={{ fontSize: `${fontSize + 2}px` }}
						>
							{board.title}
						</div>
					</div>
					<div className="rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						{cardCount} cards
					</div>
				</div>

				<div className="min-h-0 flex-1 px-4 py-4">
					<div
						className="grid h-full gap-3"
						style={{
							gridTemplateColumns: `repeat(${Math.max(board.columns.length, 1)}, minmax(0, 1fr))`,
						}}
					>
						{board.columns.map((column) => (
							<div key={column.id} className="flex min-h-0 flex-col px-2 py-2">
								<div className="mb-3 flex items-center justify-between gap-2 px-1">
									<div
										className="truncate font-semibold uppercase tracking-[0.14em] text-stone-600"
										style={{ fontSize: `${Math.max(fontSize - 1, 12)}px` }}
									>
										{column.title}
									</div>
									<div className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
										{column.cards.length}
									</div>
								</div>
								<div className="space-y-3">
									{column.cards.slice(0, 3).map((card) => {
										const checklist = card.checklist ?? [];
										const doneCount = checklist.filter((item) => item.done).length;
										const isOverdue = isKanbanCardOverdue(card.dueDate);
										const priority = PREVIEW_PRIORITY_META[card.priority ?? 'medium'];
										return (
											<div
												key={card.id}
												className="rounded-[18px] border px-4 py-3 text-xs text-stone-600 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.22)]"
												style={{
													borderColor: activeTheme.borderTone,
													backgroundColor:
														'color-mix(in srgb, var(--color-surface-strong) 98%, white)',
													minHeight: '6.5rem',
												}}
											>
												<div className="flex items-start gap-2">
													<div
														className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
														style={{ background: priority.color }}
													/>
													<div className="min-w-0 flex-1">
														<div
															className="line-clamp-2 font-semibold leading-[1.25] text-stone-800"
															style={{ fontSize: `${fontSize + 1}px` }}
														>
															{card.title}
														</div>
													</div>
												</div>

												<div className="mt-3 flex flex-wrap items-center gap-2">
													<span
														className="border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
														style={{
															borderRadius: '12px',
															borderColor: priority.borderColor,
															background: priority.background,
															color: priority.color,
														}}
													>
														{card.priority ?? 'medium'}
													</span>

													{checklist.length ? (
														<span
															className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
															style={{
																borderRadius: '12px',
																borderColor: 'var(--color-border)',
																background:
																	'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
																color: 'var(--color-text-secondary)',
															}}
														>
															<span>
																{doneCount}/{checklist.length}
															</span>
														</span>
													) : null}

													{(card.labels ?? []).slice(0, 2).map((label) => (
														<span
															key={label}
															className="border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
															style={{
																...getLabelTone(label),
																borderRadius: '12px',
															}}
														>
															{label}
														</span>
													))}
												</div>

												{checklist.length ? (
													<div className="mt-3 space-y-1.5">
														{checklist.slice(0, 2).map((item, index) => (
															<div
																key={`${card.id}-preview-check-${index}`}
																className="flex items-center gap-2 rounded-[10px] px-2 py-1.5"
																style={{
																	background: item.done
																		? 'color-mix(in srgb, var(--color-success-bg) 52%, transparent)'
																		: 'color-mix(in srgb, var(--color-surface-strong) 58%, transparent)',
																}}
															>
																<div className="text-[11px]">{item.done ? '☑' : '☐'}</div>
																<div
																	className="min-w-0 flex-1 truncate"
																	style={{
																		fontSize: `${Math.max(fontSize - 2, 11)}px`,
																		color: item.done
																			? 'var(--color-text-tertiary)'
																			: 'var(--color-text-secondary)',
																		textDecoration: item.done ? 'line-through' : 'none',
																	}}
																>
																	{item.text}
																</div>
															</div>
														))}
													</div>
												) : null}

												{card.dueDate ? (
													<div
														className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
														style={{
															color: isOverdue
																? 'var(--color-danger-text)'
																: 'var(--color-text-secondary)',
														}}
													>
														{isOverdue ? 'Overdue' : 'Due'} {formatDueDate(card.dueDate)}
													</div>
												) : null}
											</div>
										);
									})}
									{column.cards.length === 0 ? (
										<div className="rounded-[14px] border border-dashed border-stone-200/80 bg-white/50 px-3 py-4 text-xs text-stone-400">
											No cards
										</div>
									) : null}
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 border-t border-stone-200/80 px-4 py-3">
					<div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
						<span>{board.columns.length} columns</span>
						<span>{overdueCount} overdue</span>
					</div>
				</div>
			</div>
		</OverlaySurface>
	);
}

export function KanbanBoard(props: KanbanBoardProps) {
	if (props.mode === 'preview') {
		return <KanbanPreviewBoard element={props.element} isSelected={props.isSelected} />;
	}

	return (
		<KanbanBoardContainer
			element={props.element}
			mode={props.mode}
			isSelected={props.isSelected}
			isActive={props.isActive}
			onChange={props.onChange}
			onActivityChange={props.onActivityChange}
		/>
	);
}
