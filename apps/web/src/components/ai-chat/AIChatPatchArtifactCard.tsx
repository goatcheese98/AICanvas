import { useMemo } from 'react';
import type { AssistantArtifact, CanvasElement } from '@ai-canvas/shared/types';
import {
	applyAcceptedMarkdownPatchHunks,
	buildMarkdownPatchDiff,
	buildMarkdownPatchHunks,
	detectMarkdownPatchConflict,
	parseKanbanPatchArtifact,
	parseMarkdownPatchArtifact,
	summarizeKanbanPatchChanges,
} from './assistant-artifacts';
import {
	PANEL_BUTTON,
	PANEL_BUTTON_IDLE,
} from './ai-chat-constants';
import { resolveMarkdownContentFromElements } from './ai-chat-canvas';
import type {
	AssistantPatchApplyOptions,
	AssistantPatchApplyState,
	MarkdownPatchReviewState,
} from './ai-chat-types';

export function PatchArtifactCard({
	artifact,
	artifactKey,
	applyState,
	elements,
	markdownReviewState,
	onChangeMarkdownAcceptedHunks,
	onApplyPatch,
	onUndoPatch,
	onReapplyPatch,
}: {
	artifact: AssistantArtifact;
	artifactKey: string;
	applyState?: AssistantPatchApplyState;
	elements?: readonly CanvasElement[];
	markdownReviewState?: MarkdownPatchReviewState;
	onChangeMarkdownAcceptedHunks?: (artifactKey: string, acceptedHunkIds: string[]) => void;
	onApplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	onUndoPatch?: (artifactKey: string, artifact: AssistantArtifact) => void;
	onReapplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
}) {
	const markdownPatch = useMemo(() => parseMarkdownPatchArtifact(artifact), [artifact]);
	const kanbanPatch = useMemo(() => parseKanbanPatchArtifact(artifact), [artifact]);

	if (!markdownPatch && !kanbanPatch) {
		return null;
	}

	if (markdownPatch) {
		const diffLines = buildMarkdownPatchDiff(markdownPatch.base, markdownPatch.next);
		const markdownHunks = buildMarkdownPatchHunks(markdownPatch.base, markdownPatch.next);
		const acceptedHunkIds =
			markdownReviewState?.acceptedHunkIds.filter((hunkId) =>
				markdownHunks.some((hunk) => hunk.id === hunkId),
			) ?? markdownHunks.map((hunk) => hunk.id);
		const acceptedHunkIdSet = new Set(acceptedHunkIds);
		const reviewedMarkdownContent =
			markdownHunks.length > 0
				? applyAcceptedMarkdownPatchHunks(markdownPatch.base.content, markdownHunks, acceptedHunkIds)
				: markdownPatch.next.content;
		const currentMarkdownContent =
			markdownPatch.targetId && elements
				? resolveMarkdownContentFromElements(elements, markdownPatch.targetId)
				: null;
		const conflictState =
			currentMarkdownContent !== null
				? detectMarkdownPatchConflict(
						currentMarkdownContent,
						markdownPatch.base.content,
						reviewedMarkdownContent,
					)
				: 'modified';
		const isSelectableReview = markdownHunks.length > 0;
		const hasAcceptedHunks = acceptedHunkIds.length > 0;
		const isApplyBlocked =
			currentMarkdownContent === null ||
			conflictState === 'modified' ||
			(isSelectableReview && !hasAcceptedHunks);
		const applyLabel = isSelectableReview ? 'Apply Selected Hunks' : 'Apply Patch';
		const reapplyLabel = isSelectableReview ? 'Reapply Selected Hunks' : 'Reapply Patch';

		return (
			<div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3">
				<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-700">
					Markdown Patch
				</div>
				<div className="mb-3 text-[13px] text-stone-800">{markdownPatch.summary}</div>
				<div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-stone-600">
					<div className="rounded-full border border-amber-200 bg-white px-2 py-1">
						{isSelectableReview ? `${markdownHunks.length} hunks` : 'Whole patch'}
					</div>
					{isSelectableReview ? (
						<div className="rounded-full border border-stone-200 bg-white px-2 py-1">
							{acceptedHunkIds.length} selected
						</div>
					) : null}
				</div>
				{currentMarkdownContent === null ? (
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
						This markdown note is no longer available on the canvas.
					</div>
				) : conflictState === 'modified' ? (
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
						The note changed after this patch was prepared. Undo or regenerate the patch before applying.
					</div>
				) : conflictState === 'already-applied' && applyState?.status !== 'applied' ? (
					<div className="mb-3 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
						The selected hunk set already matches the current note content.
					</div>
				) : null}
				{isSelectableReview ? (
					<>
						<div className="mb-3 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() =>
									onChangeMarkdownAcceptedHunks?.(
										artifactKey,
										markdownHunks.map((hunk) => hunk.id),
									)
								}
								disabled={applyState?.status === 'applied'}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE} disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`}
							>
								Accept All
							</button>
							<button
								type="button"
								onClick={() => onChangeMarkdownAcceptedHunks?.(artifactKey, [])}
								disabled={applyState?.status === 'applied'}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE} disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`}
							>
								Reject All
							</button>
						</div>
						<div className="space-y-3">
							{markdownHunks.map((hunk, hunkIndex) => {
								const isAccepted = acceptedHunkIdSet.has(hunk.id);
								return (
									<div
										key={`${artifactKey}-${hunk.id}`}
										className={`rounded-[10px] border p-3 ${
											isAccepted ? 'border-amber-200 bg-white' : 'border-stone-200 bg-stone-50'
										}`}
									>
										<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
											<div>
												<div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
													Hunk {hunkIndex + 1}
												</div>
												<div className="text-[11px] text-stone-600">
													{hunk.addedLineCount} added, {hunk.removedLineCount} removed
												</div>
											</div>
											<button
												type="button"
												onClick={() => {
													const nextAcceptedHunkIds = isAccepted
														? acceptedHunkIds.filter((hunkId) => hunkId !== hunk.id)
														: [...acceptedHunkIds, hunk.id];
													onChangeMarkdownAcceptedHunks?.(artifactKey, nextAcceptedHunkIds);
												}}
												disabled={applyState?.status === 'applied'}
												className={`${PANEL_BUTTON} ${
													isAccepted
														? 'border-amber-300 bg-amber-100 text-amber-800 hover:border-amber-400'
														: PANEL_BUTTON_IDLE
												} disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`}
											>
												{isAccepted ? 'Reject Hunk' : 'Accept Hunk'}
											</button>
										</div>
										<div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
											<pre className="max-h-56 overflow-auto p-3 font-mono text-[11px] leading-6 text-stone-800">
												{hunk.lines.map((line, index) => (
													<div
														key={`${artifactKey}-${hunk.id}-${index}`}
														className={
															line.type === 'add'
																? 'bg-emerald-50 text-emerald-800'
																: line.type === 'remove'
																	? 'bg-rose-50 text-rose-700'
																	: 'text-stone-500'
														}
													>
														{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
														{line.text || ' '}
													</div>
												))}
											</pre>
										</div>
									</div>
								);
							})}
						</div>
					</>
				) : (
					<div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
						<pre className="max-h-56 overflow-auto p-3 font-mono text-[11px] leading-6 text-stone-800">
							{diffLines.map((line, index) => (
								<div
									key={`${artifactKey}-md-${index}`}
									className={
										line.type === 'add'
											? 'bg-emerald-50 text-emerald-800'
											: line.type === 'remove'
												? 'bg-rose-50 text-rose-700'
												: 'text-stone-500'
									}
								>
									{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
									{line.text || ' '}
								</div>
							))}
						</pre>
					</div>
				)}
				<div className="mt-3 flex flex-wrap gap-2">
					{applyState?.status === 'applied' ? (
						<button
							type="button"
							onClick={() => onUndoPatch?.(artifactKey, artifact)}
							className={`${PANEL_BUTTON} border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50`}
						>
							Undo Patch
						</button>
					) : applyState?.status === 'undone' ? (
						<button
							type="button"
							onClick={() =>
								onReapplyPatch?.(artifactKey, artifact, {
									markdownContentOverride: reviewedMarkdownContent,
								})
							}
							disabled={isApplyBlocked || conflictState === 'already-applied'}
							className={`${PANEL_BUTTON} border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`}
						>
							{conflictState === 'already-applied' ? 'Already Applied' : reapplyLabel}
						</button>
					) : (
						<button
							type="button"
							onClick={() =>
								onApplyPatch?.(artifactKey, artifact, {
									markdownContentOverride: reviewedMarkdownContent,
								})
							}
							disabled={isApplyBlocked || conflictState === 'already-applied'}
							className={`${PANEL_BUTTON} border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`}
						>
							{conflictState === 'already-applied' ? 'Already Applied' : applyLabel}
						</button>
					)}
				</div>
			</div>
		);
	}

	if (!kanbanPatch) {
		return null;
	}

	const kanbanChanges = summarizeKanbanPatchChanges(kanbanPatch);
	return (
		<div className="rounded-[10px] border border-indigo-200 bg-indigo-50 p-3">
			<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-indigo-700">
				Kanban Patch
			</div>
			<div className="mb-3 text-[13px] text-stone-800">{kanbanPatch.summary}</div>
			<div className="rounded-[10px] border border-stone-200 bg-white p-3">
				<div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					Planned Changes
				</div>
				<div className="mt-2 space-y-2">
					{kanbanChanges.map((change, index) => (
						<div
							key={`${artifactKey}-kanban-${index}`}
							className="rounded-[8px] bg-stone-50 px-3 py-2 text-[11px] text-stone-700"
						>
							{change}
						</div>
					))}
				</div>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				{applyState?.status === 'applied' ? (
					<button
						type="button"
						onClick={() => onUndoPatch?.(artifactKey, artifact)}
						className={`${PANEL_BUTTON} border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50`}
					>
						Undo Patch
					</button>
				) : applyState?.status === 'undone' ? (
					<button
						type="button"
						onClick={() => onReapplyPatch?.(artifactKey, artifact)}
						className={`${PANEL_BUTTON} border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50`}
					>
						Reapply Patch
					</button>
				) : (
					<button
						type="button"
						onClick={() => onApplyPatch?.(artifactKey, artifact)}
						className="inline-flex h-8 items-center justify-center rounded-[7px] border border-indigo-300 bg-white px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100"
					>
						Apply Patch
					</button>
				)}
			</div>
		</div>
	);
}
