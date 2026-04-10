import type { AssistantArtifact, CanvasElement } from '@ai-canvas/shared/types';
import { useMemo } from 'react';
import { resolveMarkdownContentFromElements } from './ai-chat-canvas';
import { PANEL_BUTTON, PANEL_BUTTON_IDLE } from './ai-chat-constants';
import type {
	AssistantPatchApplyOptions,
	AssistantPatchApplyState,
	MarkdownPatchReviewState,
} from './ai-chat-types';
import {
	applyAcceptedMarkdownPatchHunks,
	buildMarkdownPatchDiff,
	buildMarkdownPatchHunks,
	detectMarkdownPatchConflict,
	parseKanbanPatchArtifact,
	parseMarkdownPatchArtifact,
	summarizeKanbanPatchChanges,
} from './assistant-artifacts';

type PatchArtifactCardProps = {
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
};

type MarkdownPatchArtifact = NonNullable<ReturnType<typeof parseMarkdownPatchArtifact>>;
type KanbanPatchArtifact = NonNullable<ReturnType<typeof parseKanbanPatchArtifact>>;
type MarkdownPatchHunkList = ReturnType<typeof buildMarkdownPatchHunks>;
type MarkdownPatchDiffLines = ReturnType<typeof buildMarkdownPatchDiff>;
type MarkdownPatchConflict = ReturnType<typeof detectMarkdownPatchConflict>;

type PatchNotice = {
	className: string;
	message: string;
};

type MarkdownPatchCardState = {
	diffLinesWithKeys: Array<{ key: string; line: MarkdownPatchDiffLines[number] }>;
	markdownHunks: MarkdownPatchHunkList;
	acceptedHunkIds: string[];
	acceptedHunkIdSet: Set<string>;
	reviewedMarkdownContent: string;
	conflictState: MarkdownPatchConflict;
	isSelectableReview: boolean;
	isApplyBlocked: boolean;
	applyLabel: string;
	reapplyLabel: string;
	notice: PatchNotice | null;
};

export function PatchArtifactCard(props: PatchArtifactCardProps) {
	const { artifact } = props;
	const markdownPatch = useMemo(() => parseMarkdownPatchArtifact(artifact), [artifact]);
	const kanbanPatch = useMemo(() => parseKanbanPatchArtifact(artifact), [artifact]);

	if (markdownPatch) {
		return <MarkdownPatchCard {...props} markdownPatch={markdownPatch} />;
	}

	if (kanbanPatch) {
		return <KanbanPatchCard {...props} kanbanPatch={kanbanPatch} />;
	}

	return null;
}

function MarkdownPatchCard({
	artifact,
	artifactKey,
	applyState,
	elements,
	markdownPatch,
	markdownReviewState,
	onChangeMarkdownAcceptedHunks,
	onApplyPatch,
	onUndoPatch,
	onReapplyPatch,
}: PatchArtifactCardProps & { markdownPatch: MarkdownPatchArtifact }) {
	const state = buildMarkdownPatchCardState({
		applyState,
		artifactKey,
		elements,
		markdownPatch,
		markdownReviewState,
	});

	return (
		<div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3">
			<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-700">
				Markdown Patch
			</div>
			<div className="mb-3 text-[13px] text-stone-800">{markdownPatch.summary}</div>
			<div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-stone-600">
				<div className="rounded-full border border-amber-200 bg-white px-2 py-1">
					{state.isSelectableReview ? `${state.markdownHunks.length} hunks` : 'Whole patch'}
				</div>
				{state.isSelectableReview ? (
					<div className="rounded-full border border-stone-200 bg-white px-2 py-1">
						{state.acceptedHunkIds.length} selected
					</div>
				) : null}
			</div>
			{state.notice ? (
				<div className={`mb-3 rounded-[10px] border px-3 py-2 text-[11px] ${state.notice.className}`}>
					{state.notice.message}
				</div>
			) : null}
			<MarkdownPatchReviewBody
				acceptedHunkIds={state.acceptedHunkIds}
				acceptedHunkIdSet={state.acceptedHunkIdSet}
				applyState={applyState}
				artifactKey={artifactKey}
				diffLinesWithKeys={state.diffLinesWithKeys}
				isSelectableReview={state.isSelectableReview}
				markdownHunks={state.markdownHunks}
				onChangeMarkdownAcceptedHunks={onChangeMarkdownAcceptedHunks}
			/>
			<MarkdownPatchActionRow
				applyLabel={state.applyLabel}
				applyState={applyState}
				artifact={artifact}
				artifactKey={artifactKey}
				conflictState={state.conflictState}
				isApplyBlocked={state.isApplyBlocked}
				onApplyPatch={onApplyPatch}
				onReapplyPatch={onReapplyPatch}
				onUndoPatch={onUndoPatch}
				reapplyLabel={state.reapplyLabel}
				reviewedMarkdownContent={state.reviewedMarkdownContent}
			/>
		</div>
	);
}

function KanbanPatchCard({
	artifact,
	artifactKey,
	applyState,
	kanbanPatch,
	onApplyPatch,
	onUndoPatch,
	onReapplyPatch,
}: PatchArtifactCardProps & { kanbanPatch: KanbanPatchArtifact }) {
	const kanbanChangesWithKeys = buildKeyedKanbanChanges(
		artifactKey,
		summarizeKanbanPatchChanges(kanbanPatch),
	);

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
					{kanbanChangesWithKeys.map(({ change, key }) => (
						<div
							key={key}
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

function PatchDiffPreview({
	lines,
	keyPrefix,
	keyed = false,
}: {
	lines: MarkdownPatchDiffLines | Array<{ key: string; line: MarkdownPatchDiffLines[number] }>;
	keyPrefix: string;
	keyed?: boolean;
}) {
	const previewLines = keyed
		? (lines as Array<{ key: string; line: MarkdownPatchDiffLines[number] }>)
		: (lines as MarkdownPatchDiffLines).map((line, index) => ({
				key: `${keyPrefix}-${index}`,
				line,
			}));

	return (
		<div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
			<pre className="max-h-56 overflow-auto p-3 font-mono text-[11px] leading-6 text-stone-800">
				{previewLines.map(({ key, line }) => (
					<div key={key} className={getPatchDiffLineClassName(line.type)}>
						{getPatchDiffLinePrefix(line.type)}
						{line.text || ' '}
					</div>
				))}
			</pre>
		</div>
	);
}

function MarkdownPatchReviewBody({
	acceptedHunkIds,
	acceptedHunkIdSet,
	applyState,
	artifactKey,
	diffLinesWithKeys,
	isSelectableReview,
	markdownHunks,
	onChangeMarkdownAcceptedHunks,
}: {
	acceptedHunkIds: string[];
	acceptedHunkIdSet: Set<string>;
	applyState?: AssistantPatchApplyState;
	artifactKey: string;
	diffLinesWithKeys: Array<{ key: string; line: MarkdownPatchDiffLines[number] }>;
	isSelectableReview: boolean;
	markdownHunks: MarkdownPatchHunkList;
	onChangeMarkdownAcceptedHunks?: (artifactKey: string, acceptedHunkIds: string[]) => void;
}) {
	if (!isSelectableReview) {
		return <PatchDiffPreview lines={diffLinesWithKeys} keyPrefix={artifactKey} keyed />;
	}

	return (
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
				{markdownHunks.map((hunk, hunkIndex) => (
					<MarkdownPatchHunkCard
						key={`${artifactKey}-${hunk.id}`}
						acceptedHunkIds={acceptedHunkIds}
						acceptedHunkIdSet={acceptedHunkIdSet}
						applyState={applyState}
						artifactKey={artifactKey}
						hunk={hunk}
						hunkIndex={hunkIndex}
						onChangeMarkdownAcceptedHunks={onChangeMarkdownAcceptedHunks}
					/>
				))}
			</div>
		</>
	);
}

function MarkdownPatchHunkCard({
	acceptedHunkIds,
	acceptedHunkIdSet,
	applyState,
	artifactKey,
	hunk,
	hunkIndex,
	onChangeMarkdownAcceptedHunks,
}: {
	acceptedHunkIds: string[];
	acceptedHunkIdSet: Set<string>;
	applyState?: AssistantPatchApplyState;
	artifactKey: string;
	hunk: MarkdownPatchHunkList[number];
	hunkIndex: number;
	onChangeMarkdownAcceptedHunks?: (artifactKey: string, acceptedHunkIds: string[]) => void;
}) {
	const isAccepted = acceptedHunkIdSet.has(hunk.id);
	const nextAcceptedHunkIds = isAccepted
		? acceptedHunkIds.filter((hunkId) => hunkId !== hunk.id)
		: [...acceptedHunkIds, hunk.id];

	return (
		<div
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
					onClick={() => onChangeMarkdownAcceptedHunks?.(artifactKey, nextAcceptedHunkIds)}
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
			<PatchDiffPreview lines={hunk.lines} keyPrefix={`${artifactKey}-${hunk.id}`} />
		</div>
	);
}

function MarkdownPatchActionRow({
	applyLabel,
	applyState,
	artifact,
	artifactKey,
	conflictState,
	isApplyBlocked,
	onApplyPatch,
	onReapplyPatch,
	onUndoPatch,
	reapplyLabel,
	reviewedMarkdownContent,
}: {
	applyLabel: string;
	applyState?: AssistantPatchApplyState;
	artifact: AssistantArtifact;
	artifactKey: string;
	conflictState: MarkdownPatchConflict;
	isApplyBlocked: boolean;
	onApplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	onReapplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	onUndoPatch?: (artifactKey: string, artifact: AssistantArtifact) => void;
	reapplyLabel: string;
	reviewedMarkdownContent: string;
}) {
	if (applyState?.status === 'applied') {
		return (
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => onUndoPatch?.(artifactKey, artifact)}
					className={`${PANEL_BUTTON} border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50`}
				>
					Undo Patch
				</button>
			</div>
		);
	}

	const actionLabel =
		conflictState === 'already-applied'
			? 'Already Applied'
			: applyState?.status === 'undone'
				? reapplyLabel
				: applyLabel;
	const onClick =
		applyState?.status === 'undone'
			? () =>
					onReapplyPatch?.(artifactKey, artifact, {
						markdownContentOverride: reviewedMarkdownContent,
					})
			: () =>
					onApplyPatch?.(artifactKey, artifact, {
						markdownContentOverride: reviewedMarkdownContent,
					});
	const className =
		applyState?.status === 'undone'
			? `${PANEL_BUTTON} border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`
			: `${PANEL_BUTTON} border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400`;

	return (
		<div className="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				onClick={onClick}
				disabled={isApplyBlocked || conflictState === 'already-applied'}
				className={className}
			>
				{actionLabel}
			</button>
		</div>
	);
}

function buildMarkdownPatchCardState({
	applyState,
	artifactKey,
	elements,
	markdownPatch,
	markdownReviewState,
}: {
	applyState?: AssistantPatchApplyState;
	artifactKey: string;
	elements?: readonly CanvasElement[];
	markdownPatch: MarkdownPatchArtifact;
	markdownReviewState?: MarkdownPatchReviewState;
}): MarkdownPatchCardState {
	const diffLinesWithKeys = buildKeyedMarkdownDiffLines(
		artifactKey,
		buildMarkdownPatchDiff(markdownPatch.base, markdownPatch.next),
	);
	const markdownHunks = buildMarkdownPatchHunks(markdownPatch.base, markdownPatch.next);
	const acceptedHunkIds = getAcceptedMarkdownHunkIds(markdownHunks, markdownReviewState);
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

	return {
		diffLinesWithKeys,
		markdownHunks,
		acceptedHunkIds,
		acceptedHunkIdSet: new Set(acceptedHunkIds),
		reviewedMarkdownContent,
		conflictState,
		isSelectableReview,
		isApplyBlocked:
			currentMarkdownContent === null ||
			conflictState === 'modified' ||
			(isSelectableReview && acceptedHunkIds.length === 0),
		applyLabel: isSelectableReview ? 'Apply Selected Hunks' : 'Apply Patch',
		reapplyLabel: isSelectableReview ? 'Reapply Selected Hunks' : 'Reapply Patch',
		notice: getMarkdownPatchNotice(currentMarkdownContent, conflictState, applyState),
	};
}

function getAcceptedMarkdownHunkIds(
	markdownHunks: MarkdownPatchHunkList,
	markdownReviewState?: MarkdownPatchReviewState,
) {
	return (
		markdownReviewState?.acceptedHunkIds.filter((hunkId) =>
			markdownHunks.some((hunk) => hunk.id === hunkId),
		) ?? markdownHunks.map((hunk) => hunk.id)
	);
}

function getMarkdownPatchNotice(
	currentMarkdownContent: string | null,
	conflictState: MarkdownPatchConflict,
	applyState?: AssistantPatchApplyState,
): PatchNotice | null {
	if (currentMarkdownContent === null) {
		return {
			className: 'border-rose-200 bg-rose-50 text-rose-700',
			message: 'This markdown note is no longer available on the canvas.',
		};
	}

	if (conflictState === 'modified') {
		return {
			className: 'border-rose-200 bg-rose-50 text-rose-700',
			message: 'The note changed after this patch was prepared. Undo or regenerate the patch before applying.',
		};
	}

	if (conflictState === 'already-applied' && applyState?.status !== 'applied') {
		return {
			className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
			message: 'The selected hunk set already matches the current note content.',
		};
	}

	return null;
}

function buildKeyedMarkdownDiffLines(artifactKey: string, diffLines: MarkdownPatchDiffLines) {
	const diffLineCounts = new Map<string, number>();
	return diffLines.map((line) => {
		const baseKey = `${line.type}:${line.text}`;
		const occurrence = diffLineCounts.get(baseKey) ?? 0;
		diffLineCounts.set(baseKey, occurrence + 1);
		return {
			key: `${artifactKey}-md-${baseKey}-${occurrence}`,
			line,
		};
	});
}

function buildKeyedKanbanChanges(artifactKey: string, changes: string[]) {
	const kanbanChangeCounts = new Map<string, number>();
	return changes.map((change) => {
		const occurrence = kanbanChangeCounts.get(change) ?? 0;
		kanbanChangeCounts.set(change, occurrence + 1);
		return {
			change,
			key: `${artifactKey}-kanban-${change}-${occurrence}`,
		};
	});
}

function getPatchDiffLineClassName(type: MarkdownPatchDiffLines[number]['type']) {
	if (type === 'add') {
		return 'bg-emerald-50 text-emerald-800';
	}

	if (type === 'remove') {
		return 'bg-rose-50 text-rose-700';
	}

	return 'text-stone-500';
}

function getPatchDiffLinePrefix(type: MarkdownPatchDiffLines[number]['type']) {
	if (type === 'add') {
		return '+';
	}

	if (type === 'remove') {
		return '-';
	}

	return ' ';
}
