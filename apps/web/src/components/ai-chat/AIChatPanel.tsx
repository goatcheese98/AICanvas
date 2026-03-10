import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@clerk/clerk-react';
import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
} from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantContextMode,
	AssistantMessage,
	AssistantRunCreated,
	AssistantThread,
	CanvasElement,
} from '@ai-canvas/shared/types';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import {
	api,
	createAssistantThread,
	deleteAssistantThread,
	fetchAssistantThreads,
	fetchAssistantRun,
	fetchAssistantRunArtifacts,
	fetchAssistantRunTasks,
	getRequiredAuthHeaders,
	streamAssistantRunEvents,
} from '@/lib/api';
import {
	downloadBlob,
	renderCodeArtifactToSvg,
	svgToDataUrl,
	svgToPngBlob,
	type D2RenderVariant,
} from '@/lib/assistant/diagram-renderer';
import { useAppStore } from '@/stores/store';
import {
	createOverlayElementDraft,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import {
	applyAcceptedMarkdownPatchHunks,
	buildKanbanFromArtifact,
	buildMarkdownArtifactContent,
	buildMarkdownPatchDiff,
	buildMarkdownPatchHunks,
	buildPrototypeFromArtifact,
	buildPrototypeFromMessageContent,
	detectMarkdownPatchConflict,
	describeAssistantArtifact,
	filterVisibleArtifacts,
	getDiagramArtifactSource,
	parseKanbanPatchArtifact,
	parseMarkdownPatchArtifact,
	summarizeKanbanPatchChanges,
} from './assistant-artifacts';
import {
	applyAssistantRunEvent,
	createAssistantRunProgress,
	getAssistantRunProgressLabel,
	reconcileAssistantRunProgress,
	type AssistantRunProgress,
} from './run-progress';
import {
	buildSelectionIndicator,
	getSelectedElementIdsFromMap,
	shouldConfirmSelectionForPrompt,
} from './selection-context';

const PANEL_BUTTON =
	'inline-flex h-9 items-center justify-center rounded-[8px] border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors';
const PANEL_BUTTON_IDLE =
	'border-stone-300 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const PANEL_BUTTON_ACTIVE =
	'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]';
const PANEL_BUTTON_DANGER =
	'border-stone-300 bg-white text-stone-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600';

let convertToExcalidrawElementsLoader: Promise<
	typeof import('@excalidraw/excalidraw')['convertToExcalidrawElements']
> | null = null;

type AssistantPatchApplyState = {
	status: 'idle' | 'applied' | 'undone';
	targetId: string;
	targetType: 'markdown' | 'kanban';
	previousCustomData: Record<string, unknown>;
};

type MarkdownPatchReviewState = {
	acceptedHunkIds: string[];
};

type AssistantPatchApplyOptions = {
	markdownContentOverride?: string;
};

function clonePatchCustomData<T extends Record<string, unknown>>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

function buildConversationHistory(messages: AssistantMessage[]): AssistantMessage[] {
	return messages.slice(-12).map((message) => ({
		id: message.id,
		role: message.role,
		content: message.content,
		generationMode: message.generationMode,
		artifacts: message.artifacts,
		createdAt: message.createdAt,
	}));
}

function canInsertMessageAsMarkdown(message: AssistantMessage): boolean {
	return (
		message.role === 'assistant' &&
		message.content.trim().length > 0 &&
		!(message.artifacts ?? []).some(
			(artifact) =>
				artifact.type === 'kanban-ops' ||
				artifact.type === 'markdown-patch' ||
				artifact.type === 'kanban-patch',
		)
	);
}

function canApplyMessageAsPrototype(message: AssistantMessage): boolean {
	return message.role === 'assistant' && buildPrototypeFromMessageContent(message.content) !== null;
}

function resolveMarkdownContentFromElements(
	elements: readonly CanvasElement[],
	targetId: string,
): string | null {
	const match = elements.find((candidate) => String(candidate.id) === targetId);
	if (!match) {
		return null;
	}

	const customData = (match.customData as Record<string, unknown> | undefined) ?? {};
	if (customData.type !== 'markdown') {
		return null;
	}

	return normalizeMarkdownOverlay(customData).content;
}

function getSelectedPrototypeElement(
	elements: readonly Record<string, unknown>[],
	selectedElementIds: Record<string, boolean>,
) {
	const selectedElements = elements.filter(
		(candidate) =>
			selectedElementIds[String(candidate.id)] === true &&
			(candidate.customData as { type?: string } | undefined)?.type === 'prototype',
	);

	return selectedElements.length === 1 ? selectedElements[0] : null;
}

async function getConvertToExcalidrawElements() {
	if (!convertToExcalidrawElementsLoader) {
		convertToExcalidrawElementsLoader = import('@excalidraw/excalidraw').then(
			(module) => module.convertToExcalidrawElements,
		);
	}
	return convertToExcalidrawElementsLoader;
}

async function writeToClipboard(value: string) {
	if (!value.trim()) {
		throw new Error('Nothing to copy.');
	}

	if (!navigator.clipboard?.writeText) {
		throw new Error('Clipboard is unavailable.');
	}

	await navigator.clipboard.writeText(value);
}

function createCanvasImageElement(input: {
	fileId: BinaryFileData['id'];
	x: number;
	y: number;
	width: number;
	height: number;
	customData?: Record<string, unknown>;
}) {
	return {
		id: crypto.randomUUID(),
		type: 'image' as const,
		fileId: input.fileId,
		status: 'saved' as const,
		scale: [1, 1] as [number, number],
		crop: null,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		angle: 0,
		strokeColor: 'transparent',
		backgroundColor: 'transparent',
		fillStyle: 'solid' as const,
		strokeWidth: 0,
		strokeStyle: 'solid' as const,
		roughness: 0,
		opacity: 100,
		roundness: null,
		seed: Math.floor(Math.random() * 100000),
		version: 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
		isDeleted: false,
		groupIds: [],
		frameId: null,
		boundElements: null,
		updated: Date.now(),
		link: null,
		locked: false,
		index: `a${Date.now()}` as any,
		...(input.customData ? { customData: input.customData } : {}),
	} as const;
}

function getThreadPreview(thread: { messages: AssistantMessage[] }) {
	if (!thread.messages.some((message) => message.role === 'user')) {
		return 'No requests yet';
	}

	const preview = thread.messages.at(-1)?.content?.replace(/\s+/g, ' ').trim() ?? '';
	return preview || 'No messages yet';
}

function getThreadDisplayTitle(thread: { title: string; messages: AssistantMessage[] }) {
	return thread.messages.some((message) => message.role === 'user') ? thread.title : 'New chat';
}

function getThreadMonogram(title: string) {
	const monogram = title
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('');

	return monogram || 'AI';
}

function formatThreadTimestamp(updatedAt: string) {
	const timestamp = new Date(updatedAt);
	const now = new Date();
	const sameDay = timestamp.toDateString() === now.toDateString();

	return sameDay
		? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
		: timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CopyButton({
	value,
	label = 'Copy',
	className = '',
	onCopied,
}: {
	value: string;
	label?: string;
	className?: string;
	onCopied?: () => void;
}) {
	const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

	return (
		<button
			type="button"
			onClick={async () => {
				try {
					await writeToClipboard(value);
					setStatus('copied');
					onCopied?.();
					window.setTimeout(() => setStatus('idle'), 1400);
				} catch {
					setStatus('failed');
					window.setTimeout(() => setStatus('idle'), 1600);
				}
			}}
			className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE} ${className}`.trim()}
		>
			{status === 'copied' ? 'Copied' : status === 'failed' ? 'Retry' : label}
		</button>
	);
}

function CodeSnippet({
	code,
	language,
	compact = false,
}: {
	code: string;
	language?: string;
	compact?: boolean;
}) {
	return (
		<div className="group relative overflow-hidden rounded-[10px] border border-stone-200 bg-stone-100">
			<CopyButton
				value={code}
				label="Copy"
				className="absolute right-2 top-2 z-10 h-7 px-2 text-[9px] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
			/>
			{language ? (
				<div className="border-b border-stone-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					{language}
				</div>
			) : null}
			<pre
				className={`overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-stone-800 ${
					compact ? 'max-h-44' : 'max-h-72'
				}`}
			>
				<code>{code}</code>
			</pre>
		</div>
	);
}

function DiagramArtifactCard({
	artifact,
	onInsertRenderedDiagram,
}: {
	artifact: AssistantArtifact;
	onInsertRenderedDiagram?: (input: {
		title: string;
		svgMarkup: string;
		width: number;
		height: number;
		diagram: {
			language: 'mermaid' | 'd2';
			code: string;
		};
	}) => void;
}) {
	const diagram = useMemo(() => getDiagramArtifactSource(artifact), [artifact]);
	const [d2Variant, setD2Variant] = useState<D2RenderVariant>('default');
	const [rendered, setRendered] = useState<{
		svgMarkup: string;
		width: number;
		height: number;
	} | null>(null);
	const [renderError, setRenderError] = useState<string | null>(null);
	const [isRendering, setIsRendering] = useState(false);

	useEffect(() => {
		if (!diagram) {
			setRendered(null);
			setRenderError(null);
			return;
		}

		let isCurrent = true;
		setIsRendering(true);
		setRenderError(null);

		void renderCodeArtifactToSvg({
			language: diagram.language,
			code: diagram.code,
			d2Variant,
		})
			.then((result) => {
				if (!isCurrent) return;
				setRendered(result);
			})
			.catch((error) => {
				if (!isCurrent) return;
				setRenderError(error instanceof Error ? error.message : 'Failed to render diagram');
				setRendered(null);
			})
			.finally(() => {
				if (isCurrent) {
					setIsRendering(false);
				}
			});

		return () => {
			isCurrent = false;
		};
	}, [d2Variant, diagram]);

	if (!diagram) {
		return null;
	}

	const title = diagram.language === 'mermaid' ? 'Mermaid Diagram' : 'D2 Diagram';

	return (
		<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
					{title}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{diagram.language === 'd2' ? (
						<select
							value={d2Variant}
							onChange={(event) => setD2Variant(event.target.value as D2RenderVariant)}
							className={`h-9 rounded-[8px] border border-stone-300 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 ${PANEL_BUTTON_IDLE}`}
						>
							<option value="default">Default</option>
							<option value="sketch">Sketch</option>
							<option value="ascii">Ascii</option>
						</select>
					) : null}
					{rendered && onInsertRenderedDiagram ? (
						<button
							type="button"
							onClick={() =>
								onInsertRenderedDiagram({
									title,
									svgMarkup: rendered.svgMarkup,
									width: rendered.width,
									height: rendered.height,
									diagram: {
										language: diagram.language,
										code: diagram.code,
									},
								})
							}
							className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
						>
							Insert On Canvas
						</button>
					) : null}
					{rendered ? (
						<>
							<button
								type="button"
								onClick={() =>
									downloadBlob(
										new Blob([rendered.svgMarkup], { type: 'image/svg+xml' }),
										`${diagram.language}${diagram.language === 'd2' ? `-${d2Variant}` : ''}.svg`,
									)
								}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
							>
								Download SVG
							</button>
							<button
								type="button"
								onClick={async () => {
									const png = await svgToPngBlob(
										rendered.svgMarkup,
										rendered.width,
										rendered.height,
									);
									downloadBlob(
										png,
										`${diagram.language}${diagram.language === 'd2' ? `-${d2Variant}` : ''}.png`,
									);
								}}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
							>
								Download PNG
							</button>
						</>
					) : null}
				</div>
			</div>
			<div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
				{isRendering ? (
					<div className="px-4 py-10 text-center text-sm text-stone-500">Rendering diagram...</div>
				) : renderError ? (
					<div className="px-4 py-10 text-center text-sm text-rose-700">{renderError}</div>
				) : rendered ? (
					<div
						className="max-h-[320px] overflow-auto p-3"
						dangerouslySetInnerHTML={{ __html: rendered.svgMarkup }}
					/>
				) : null}
			</div>
			<details className="mt-3">
				<summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					View Source
				</summary>
				<div className="mt-3">
					<CodeSnippet
						code={diagram.code}
						language={diagram.language === 'mermaid' ? 'Mermaid' : `D2 ${d2Variant}`}
						compact
					/>
				</div>
			</details>
		</div>
	);
}

function PatchArtifactCard({
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
				<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
					Markdown Patch
				</div>
				<div className="mb-3 text-sm text-stone-800">{markdownPatch.summary}</div>
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
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
						This markdown note is no longer available on the canvas.
					</div>
				) : conflictState === 'modified' ? (
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
						The note changed after this patch was prepared. Undo or regenerate the patch before applying.
					</div>
				) : conflictState === 'already-applied' && applyState?.status !== 'applied' ? (
					<div className="mb-3 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
												<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
													Hunk {hunkIndex + 1}
												</div>
												<div className="text-xs text-stone-600">
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
											<pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-6 text-stone-800">
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
						<pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-6 text-stone-800">
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
			<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-700">
				Kanban Patch
			</div>
			<div className="mb-3 text-sm text-stone-800">{kanbanPatch.summary}</div>
			<div className="rounded-[10px] border border-stone-200 bg-white p-3">
				<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					Planned Changes
				</div>
				<div className="mt-2 space-y-2">
					{kanbanChanges.map((change, index) => (
						<div
							key={`${artifactKey}-kanban-${index}`}
							className="rounded-[8px] bg-stone-50 px-3 py-2 text-xs text-stone-700"
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
						className="inline-flex h-9 items-center justify-center rounded-[8px] border border-indigo-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100"
					>
						Apply Patch
					</button>
				)}
			</div>
		</div>
	);
}

function ArtifactCard({
	artifact,
	artifactKey,
	elements,
	onInsertArtifact,
	onInsertRenderedDiagram,
	patchApplyState,
	markdownReviewState,
	onChangeMarkdownAcceptedHunks,
	onApplyPatch,
	onUndoPatch,
	onReapplyPatch,
}: {
	artifact: AssistantArtifact;
	artifactKey: string;
	elements?: readonly CanvasElement[];
	onInsertArtifact?: (artifact: AssistantArtifact) => void;
	onInsertRenderedDiagram?: (input: {
		title: string;
		svgMarkup: string;
		width: number;
		height: number;
		diagram: {
			language: 'mermaid' | 'd2';
			code: string;
		};
	}) => void;
	patchApplyState?: AssistantPatchApplyState;
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
	const diagram = getDiagramArtifactSource(artifact);
	if (diagram) {
		return (
			<DiagramArtifactCard
				artifact={artifact}
				onInsertRenderedDiagram={onInsertRenderedDiagram}
			/>
		);
	}

	if (artifact.type === 'markdown-patch' || artifact.type === 'kanban-patch') {
		return (
			<PatchArtifactCard
				artifact={artifact}
				artifactKey={artifactKey}
				applyState={patchApplyState}
				elements={elements}
				markdownReviewState={markdownReviewState}
				onChangeMarkdownAcceptedHunks={onChangeMarkdownAcceptedHunks}
				onApplyPatch={onApplyPatch}
				onUndoPatch={onUndoPatch}
				onReapplyPatch={onReapplyPatch}
			/>
		);
	}

	switch (artifact.type) {
		case 'markdown':
			return (
				<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
						Markdown
					</div>
					<CodeSnippet code={artifact.content} language="Markdown" compact />
					{onInsertArtifact ? (
						<button
							type="button"
							onClick={() => onInsertArtifact(artifact)}
							className={`mt-3 ${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
						>
							Insert On Canvas
						</button>
					) : null}
				</div>
			);
		case 'kanban-ops':
			return (
				<div className="rounded-[10px] border border-indigo-200 bg-indigo-50 p-3">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
						Kanban Ops
					</div>
					<CodeSnippet code={artifact.content} language="JSON" compact />
					{onInsertArtifact ? (
						<button
							type="button"
							onClick={() => onInsertArtifact(artifact)}
							className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] border border-indigo-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100"
						>
							Insert On Canvas
						</button>
					) : null}
				</div>
			);
		case 'prototype-files':
			return (
				<div className="rounded-[10px] border border-sky-200 bg-sky-50 p-3">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">
						Prototype Files
					</div>
					<CodeSnippet code={artifact.content} language="JSON" compact />
					{onInsertArtifact ? (
						<button
							type="button"
							onClick={() => onInsertArtifact(artifact)}
							className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] border border-sky-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 transition-colors hover:border-sky-400 hover:bg-sky-100"
						>
							Apply Prototype
						</button>
					) : null}
				</div>
			);
		case 'image':
			return (
				<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
					<CodeSnippet code={describeAssistantArtifact(artifact)} language="Image" compact />
				</div>
			);
		case 'image-vector':
			return (
				<div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
					<CodeSnippet code={describeAssistantArtifact(artifact)} language="Vector Asset" compact />
				</div>
			);
		case 'layout-plan':
			return (
				<div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3">
					<details>
						<summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
							Layout Plan
						</summary>
						<div className="mt-3">
							<CodeSnippet code={artifact.content} language="JSON" compact />
						</div>
					</details>
				</div>
			);
		default:
			return null;
	}
}

function MessageCard({
	message,
	elements,
	onInsertArtifact,
	onInsertMarkdown,
	onInsertPrototype,
	onInsertRenderedDiagram,
	patchStates,
	markdownPatchReviewStates,
	onChangeMarkdownAcceptedHunks,
	onApplyPatch,
	onUndoPatch,
	onReapplyPatch,
}: {
	message: AssistantMessage;
	elements?: readonly CanvasElement[];
	onInsertArtifact?: (artifact: AssistantArtifact) => void;
	onInsertMarkdown?: (message: AssistantMessage) => void;
	onInsertPrototype?: (message: AssistantMessage) => void;
	onInsertRenderedDiagram?: (input: {
		title: string;
		svgMarkup: string;
		width: number;
		height: number;
		diagram: {
			language: 'mermaid' | 'd2';
			code: string;
		};
	}) => void;
	patchStates?: Record<string, AssistantPatchApplyState>;
	markdownPatchReviewStates?: Record<string, MarkdownPatchReviewState>;
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
	const isUser = message.role === 'user';
	const visibleArtifacts = filterVisibleArtifacts(message.artifacts ?? []);

	return (
		<div
			className={`max-w-[92%] rounded-[16px] px-4 py-3 shadow-sm ${
				isUser
					? 'ml-auto border border-[#d7dafd] bg-[#f3f1ff] text-[#4d55cc] shadow-none'
					: 'mr-auto border border-stone-200 bg-white text-stone-900 shadow-none'
			}`}
		>
			<div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
				<span>{isUser ? 'You' : message.generationMode ?? 'Assistant'}</span>
				<div className="flex items-center gap-2">
					<span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
					{!isUser ? <CopyButton value={message.content} label="Copy" className="h-7 px-2 text-[9px]" /> : null}
				</div>
			</div>
			{isUser ? (
				<div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
			) : (
				<div className="text-sm leading-relaxed">
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						components={{
							p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
							strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
							em: ({ children }) => <em className="italic">{children}</em>,
							ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>,
							ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4">{children}</ol>,
							li: ({ children }) => <li className="text-sm">{children}</li>,
							h1: ({ children }) => <h1 className="mb-2 text-base font-semibold">{children}</h1>,
							h2: ({ children }) => <h2 className="mb-1.5 text-sm font-semibold">{children}</h2>,
							h3: ({ children }) => <h3 className="mb-1 text-sm font-medium">{children}</h3>,
							code: ({ node, className, children, ...props }) => {
								const isBlock =
									(node?.position?.start.line ?? 0) !== (node?.position?.end.line ?? 0);
								if (!isBlock) {
									return (
										<code
											className="rounded bg-stone-100 px-1 py-0.5 text-xs font-mono"
											{...props}
										>
											{children}
										</code>
									);
								}

								const language = className?.replace(/^language-/, '') ?? 'Code';
								const code = String(children).replace(/\n$/, '');
								return <CodeSnippet code={code} language={language} />;
							},
							pre: ({ children }) => <div className="mb-2">{children}</div>,
							blockquote: ({ children }) => (
								<blockquote className="border-l-2 border-stone-300 pl-3 italic text-stone-600">
									{children}
								</blockquote>
							),
							a: ({ href, children }) => (
								<a
									href={href}
									className="text-[#4d55cc] underline"
									target="_blank"
									rel="noopener noreferrer"
								>
									{children}
								</a>
							),
						}}
					>
						{message.content}
					</ReactMarkdown>
				</div>
			)}
			{visibleArtifacts.length > 0 ? (
				<div className="mt-3 space-y-3">
					{visibleArtifacts.map((artifact, index) => {
						const artifactKey = `${message.id}-${artifact.type}-${index}`;
						return (
						<ArtifactCard
							key={artifactKey}
							artifact={artifact}
							artifactKey={artifactKey}
							elements={elements}
							onInsertArtifact={onInsertArtifact}
							onInsertRenderedDiagram={onInsertRenderedDiagram}
							patchApplyState={patchStates?.[artifactKey]}
							markdownReviewState={markdownPatchReviewStates?.[artifactKey]}
							onChangeMarkdownAcceptedHunks={onChangeMarkdownAcceptedHunks}
							onApplyPatch={onApplyPatch}
							onUndoPatch={onUndoPatch}
							onReapplyPatch={onReapplyPatch}
						/>
						);
					})}
				</div>
			) : null}
			{!isUser && canInsertMessageAsMarkdown(message) && onInsertMarkdown ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{canApplyMessageAsPrototype(message) && onInsertPrototype ? (
						<button
							type="button"
							onClick={() => onInsertPrototype(message)}
							className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
						>
							Apply Prototype
						</button>
					) : null}
					<button
						type="button"
						onClick={() => onInsertMarkdown(message)}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
					>
						Insert As Markdown
					</button>
				</div>
			) : null}
		</div>
	);
}

function SelectionConfirmationCard({
	prompt,
	selectionLabel,
	onUseSelection,
	onContinueWithoutSelection,
}: {
	prompt: string;
	selectionLabel: string;
	onUseSelection: () => void;
	onContinueWithoutSelection: () => void;
}) {
	return (
		<div className="mr-auto max-w-[92%] rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-stone-900 shadow-none">
			<div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
				<span>Assistant</span>
				<span>Context Check</span>
			</div>
			<div className="text-sm leading-relaxed">
				This request looks like it refers to the current selection. {selectionLabel}.
			</div>
			<div className="mt-2 rounded-[10px] border border-amber-200 bg-white/70 px-3 py-2 text-xs text-stone-600">
				{prompt}
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={onUseSelection}
					className={`${PANEL_BUTTON} border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-100`}
				>
					Use Selection And Continue
				</button>
				<button
					type="button"
					onClick={onContinueWithoutSelection}
					className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
				>
					Continue Without Selection
				</button>
			</div>
		</div>
	);
}

export function AIChatPanel({ canvasId }: { canvasId: string }) {
	const { getToken, isSignedIn } = useAuth();
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const isChatLoading = useAppStore((s) => s.isChatLoading);
	const chatError = useAppStore((s) => s.chatError);
	const contextMode = useAppStore((s) => s.contextMode);
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore(
		(s) => (s.appState.selectedElementIds ?? {}) as Record<string, boolean>,
	);
	const setElements = useAppStore((s) => s.setElements);
	const setFiles = useAppStore((s) => s.setFiles);
	const setIsChatLoading = useAppStore((s) => s.setIsChatLoading);
	const setChatError = useAppStore((s) => s.setChatError);
	const setContextMode = useAppStore((s) => s.setContextMode);
	const [input, setInput] = useState('');
	const [threads, setThreads] = useState<AssistantThread[]>([]);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [isThreadsLoading, setIsThreadsLoading] = useState(false);
	const [runProgress, setRunProgress] = useState<AssistantRunProgress | null>(null);
	const [isRunProgressExpanded, setIsRunProgressExpanded] = useState(true);
	const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
	const [assistantPatchStates, setAssistantPatchStates] = useState<
		Record<string, AssistantPatchApplyState>
	>({});
	const [markdownPatchReviewStates, setMarkdownPatchReviewStates] = useState<
		Record<string, MarkdownPatchReviewState>
	>({});
	const [pendingSelectionConfirmation, setPendingSelectionConfirmation] = useState<{
		prompt: string;
		createdAt: string;
	} | null>(null);

	const currentThread = useMemo(
		() => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
		[activeThreadId, threads],
	);
	const messages = currentThread?.messages ?? [];
	const selectionIndicator = useMemo(
		() => buildSelectionIndicator(elements as unknown as CanvasElement[], selectedElementIds),
		[elements, selectedElementIds],
	);
	const disabled = useMemo(
		() => !input.trim() || isChatLoading || isThreadsLoading,
		[input, isChatLoading, isThreadsLoading],
	);

	useEffect(() => {
		setRunProgress(null);
		setChatError(null);
		setAssistantPatchStates({});
		setMarkdownPatchReviewStates({});
		setPendingSelectionConfirmation(null);
	}, [activeThreadId, setChatError]);

	useEffect(() => {
		if (!selectionIndicator) {
			setPendingSelectionConfirmation(null);
		}
	}, [selectionIndicator]);

	useEffect(() => {
		if (!runProgress) {
			return;
		}

		if (runProgress.status === 'queued' || runProgress.status === 'running') {
			setIsRunProgressExpanded(true);
			return;
		}

		setIsRunProgressExpanded(false);
	}, [runProgress?.runId, runProgress?.status]);

	useEffect(() => {
		let cancelled = false;

		const loadThreads = async () => {
			if (!isSignedIn) {
				if (!cancelled) {
					setThreads([]);
					setActiveThreadId(null);
					setIsThreadsLoading(false);
				}
				return;
			}

			setIsThreadsLoading(true);
			try {
				const headers = await getRequiredAuthHeaders(getToken);
				const nextThreads = await fetchAssistantThreads(canvasId, headers);
				if (cancelled) {
					return;
				}

				setThreads(nextThreads);
				setActiveThreadId((current) =>
					nextThreads.some((thread) => thread.id === current)
						? current
						: nextThreads[0]?.id ?? null,
				);
				setChatError(null);
			} catch (error) {
				if (!cancelled) {
					setChatError(error instanceof Error ? error.message : 'Failed to load assistant threads');
				}
			} finally {
				if (!cancelled) {
					setIsThreadsLoading(false);
				}
			}
		};

		void loadThreads();

		return () => {
			cancelled = true;
		};
	}, [canvasId, getToken, isSignedIn, setChatError]);

	const appendMessageToThread = (threadId: string, message: AssistantMessage) => {
		setThreads((currentThreads) =>
			currentThreads.map((thread) => {
				if (thread.id !== threadId) {
					return thread;
				}

				const nextMessages = [...thread.messages, message];
				return {
					...thread,
					title:
						thread.title === 'New chat' && message.role === 'user'
							? message.content.trim().replace(/\s+/g, ' ').slice(0, 40) || thread.title
							: thread.title,
					messages: nextMessages,
					updatedAt: message.createdAt,
				};
			}),
		);
	};

	const createThread = async (title?: string) => {
		const headers = await getRequiredAuthHeaders(getToken);
		const thread = await createAssistantThread({ canvasId, title }, headers);
		setThreads((currentThreads) => [thread, ...currentThreads]);
		setActiveThreadId(thread.id);
		return thread;
	};

	const removeThread = async (threadId: string) => {
		const headers = await getRequiredAuthHeaders(getToken);
		await deleteAssistantThread(threadId, headers);
		let nextActiveThreadId: string | null = null;
		setThreads((currentThreads) => {
			const remainingThreads = currentThreads.filter((thread) => thread.id !== threadId);
			nextActiveThreadId = remainingThreads[0]?.id ?? null;
			return remainingThreads;
		});
		setActiveThreadId((current) => (current === threadId ? nextActiveThreadId : current));
	};

	const updateOverlayElementById = (
		targetId: string,
		targetType: 'markdown' | 'kanban',
		payload: Record<string, unknown>,
	) => {
		if (!excalidrawApi) {
			throw new Error('Canvas is not ready yet.');
		}

		const currentElements = excalidrawApi.getSceneElements();
		let previousCustomData: Record<string, unknown> | null = null;
		let didUpdate = false;
		const nextElements = currentElements.map((candidate) => {
			if (candidate.id !== targetId) {
				return candidate;
			}

			previousCustomData = clonePatchCustomData(
				(candidate.customData as Record<string, unknown> | undefined) ?? {},
			);
			didUpdate = true;

			if (targetType === 'markdown') {
				const markdown = normalizeMarkdownOverlay(payload);
				return applyOverlayUpdateByType('markdown', candidate as never, {
					title: markdown.title,
					content: markdown.content,
					images: markdown.images,
					settings: markdown.settings,
					editorMode: markdown.editorMode,
				}) as typeof candidate;
			}

			const board = normalizeKanbanOverlay(payload);
			return applyOverlayUpdateByType('kanban', candidate as never, board) as typeof candidate;
		});

		if (!didUpdate || !previousCustomData) {
			throw new Error('Selected canvas item is no longer available.');
		}

		excalidrawApi.updateScene({ elements: nextElements });
		setElements(nextElements);
		return previousCustomData;
	};

	const applyAssistantPatch = (
		artifactKey: string,
		artifact: AssistantArtifact,
		mode: 'apply' | 'reapply' = 'apply',
		options?: AssistantPatchApplyOptions,
	) => {
		try {
			const markdownPatch = parseMarkdownPatchArtifact(artifact);
			if (markdownPatch) {
				const nextMarkdownContent =
					options?.markdownContentOverride ?? markdownPatch.next.content;
				const previousCustomData =
					mode === 'reapply'
						? assistantPatchStates[artifactKey]?.previousCustomData
						: updateOverlayElementById(markdownPatch.targetId, 'markdown', {
							type: 'markdown',
							title: markdownPatch.next.title,
							content: nextMarkdownContent,
							images: markdownPatch.next.images,
							settings: markdownPatch.next.settings,
							editorMode: markdownPatch.next.editorMode,
						});

				if (mode === 'reapply') {
					updateOverlayElementById(markdownPatch.targetId, 'markdown', {
						type: 'markdown',
						title: markdownPatch.next.title,
						content: nextMarkdownContent,
						images: markdownPatch.next.images,
						settings: markdownPatch.next.settings,
						editorMode: markdownPatch.next.editorMode,
					});
				}

				setAssistantPatchStates((current) => ({
					...current,
					[artifactKey]: {
						status: 'applied',
						targetId: markdownPatch.targetId,
						targetType: 'markdown',
						previousCustomData: clonePatchCustomData(previousCustomData),
					},
				}));
				return;
			}

			const kanbanPatch = parseKanbanPatchArtifact(artifact);
			if (kanbanPatch) {
				const previousCustomData =
					mode === 'reapply'
						? assistantPatchStates[artifactKey]?.previousCustomData
						: updateOverlayElementById(kanbanPatch.targetId, 'kanban', kanbanPatch.next as unknown as Record<string, unknown>);

				if (mode === 'reapply') {
					updateOverlayElementById(
						kanbanPatch.targetId,
						'kanban',
						kanbanPatch.next as unknown as Record<string, unknown>,
					);
				}

				setAssistantPatchStates((current) => ({
					...current,
					[artifactKey]: {
						status: 'applied',
						targetId: kanbanPatch.targetId,
						targetType: 'kanban',
						previousCustomData: clonePatchCustomData(previousCustomData),
					},
				}));
				return;
			}

			throw new Error('Patch artifact is invalid.');
		} catch (error) {
			setChatError(error instanceof Error ? error.message : 'Failed to apply patch');
		}
	};

	const updateMarkdownPatchAcceptedHunks = (artifactKey: string, acceptedHunkIds: string[]) => {
		setMarkdownPatchReviewStates((current) => ({
			...current,
			[artifactKey]: {
				acceptedHunkIds: [...acceptedHunkIds],
			},
		}));
	};

	const undoAssistantPatch = (artifactKey: string) => {
		const patchState = assistantPatchStates[artifactKey];
		if (!patchState) {
			setChatError('Patch history is unavailable.');
			return;
		}

		try {
			updateOverlayElementById(
				patchState.targetId,
				patchState.targetType,
				patchState.previousCustomData,
			);
			setAssistantPatchStates((current) => ({
				...current,
				[artifactKey]: {
					...patchState,
					status: 'undone',
				},
			}));
		} catch (error) {
			setChatError(error instanceof Error ? error.message : 'Failed to undo patch');
		}
	};

	const insertMarkdownOnCanvas = async (content: string) => {
		if (!excalidrawApi) {
			setChatError('Canvas is not ready yet.');
			return;
		}

		const convertToExcalidrawElements = await getConvertToExcalidrawElements();
		const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
		const currentElements = excalidrawApi.getSceneElements();
		const draft = createOverlayElementDraft('markdown', sceneCenter, { content });
		const converted = convertToExcalidrawElements([draft as never]);
		excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
	};

	const insertRenderedDiagramOnCanvas = async (input: {
		title: string;
		svgMarkup: string;
		width: number;
		height: number;
		diagram: {
			language: 'mermaid' | 'd2';
			code: string;
		};
	}) => {
		if (!excalidrawApi) {
			setChatError('Canvas is not ready yet.');
			return;
		}

		const dataURL = svgToDataUrl(input.svgMarkup) as BinaryFileData['dataURL'];
		const fileId = crypto.randomUUID() as BinaryFileData['id'];
		const now = Date.now();
		const imageFile: BinaryFileData = {
			id: fileId,
			mimeType: 'image/svg+xml',
			dataURL,
			created: now,
		};
		const currentElements = excalidrawApi.getSceneElements();
		const currentFiles = excalidrawApi.getFiles();
		const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
		const width = Math.max(200, Math.round(input.width));
		const height = Math.max(120, Math.round(input.height));
		const imageElement = createCanvasImageElement({
			fileId,
			x: sceneCenter.x - width / 2,
			y: sceneCenter.y - height / 2,
			width,
			height,
			customData: {
				type: 'ai-generated-diagram',
				title: input.title,
				language: input.diagram.language,
				code: input.diagram.code,
			},
		});

		excalidrawApi.addFiles([imageFile]);
		excalidrawApi.updateScene({
			elements: [...currentElements, imageElement],
			appState: {
				selectedElementIds: { [imageElement.id]: true },
			},
		});
		setFiles({
			...currentFiles,
			[fileId]: imageFile,
		});
		setElements([...currentElements, imageElement]);
	};

	const getPrototypeContextForRequest = (effectiveContextMode: AssistantContextMode) => {
		if (effectiveContextMode !== 'selected') {
			return undefined;
		}

		const selectedPrototype = getSelectedPrototypeElement(
			elements as unknown as Record<string, unknown>[],
			selectedElementIds,
		);
		if (!selectedPrototype) {
			return undefined;
		}

		return normalizePrototypeOverlay(selectedPrototype.customData as Record<string, unknown>);
	};

	const insertArtifactOnCanvas = async (artifact: AssistantArtifact) => {
		if (!excalidrawApi) {
			setChatError('Canvas is not ready yet.');
			return;
		}

		const convertToExcalidrawElements = await getConvertToExcalidrawElements();
		const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
		const currentElements = excalidrawApi.getSceneElements();

		switch (artifact.type) {
			case 'kanban-ops': {
				const draft = createOverlayElementDraft(
					'kanban',
					sceneCenter,
					buildKanbanFromArtifact(artifact) as unknown as Record<string, unknown>,
				);
				const converted = convertToExcalidrawElements([draft as never]);
				excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
				break;
			}
			case 'mermaid':
			case 'd2':
			case 'markdown': {
				await insertMarkdownOnCanvas(buildMarkdownArtifactContent(artifact));
				break;
			}
			case 'prototype-files': {
				const prototype = buildPrototypeFromArtifact(artifact);
				const selectedPrototype = getSelectedPrototypeElement(
					currentElements as unknown as Record<string, unknown>[],
					selectedElementIds,
				);

				if (selectedPrototype) {
					const nextElements = currentElements.map((candidate) =>
						candidate.id === selectedPrototype.id
							? applyOverlayUpdateByType('prototype', candidate as never, {
									title: prototype.title,
									template: prototype.template,
									files: prototype.files,
									dependencies: prototype.dependencies,
									preview: prototype.preview,
									activeFile: prototype.activeFile,
									showEditor: prototype.showEditor,
									showPreview: prototype.showPreview,
							  }) as typeof candidate
							: candidate,
					);
					excalidrawApi.updateScene({ elements: nextElements });
					setElements(nextElements);
					break;
				}

				const draft = createOverlayElementDraft(
					'prototype',
					sceneCenter,
					prototype as unknown as Record<string, unknown>,
				);
				const converted = convertToExcalidrawElements([draft as never]);
				excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
				break;
			}
			default:
				setChatError('This artifact type is not insertable yet.');
		}
	};

	const insertPrototypeOnCanvas = async (prototype: ReturnType<typeof buildPrototypeFromMessageContent>) => {
		if (!prototype || !excalidrawApi) {
			setChatError('Canvas is not ready yet.');
			return;
		}

		const convertToExcalidrawElements = await getConvertToExcalidrawElements();
		const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
		const currentElements = excalidrawApi.getSceneElements();
		const selectedPrototype = getSelectedPrototypeElement(
			currentElements as unknown as Record<string, unknown>[],
			selectedElementIds,
		);

		if (selectedPrototype) {
			const nextElements = currentElements.map((candidate) =>
				candidate.id === selectedPrototype.id
					? applyOverlayUpdateByType('prototype', candidate as never, {
							title: prototype.title,
							template: prototype.template,
							files: prototype.files,
							dependencies: prototype.dependencies,
							preview: prototype.preview,
							activeFile: prototype.activeFile,
							showEditor: prototype.showEditor,
							showPreview: prototype.showPreview,
					  }) as typeof candidate
					: candidate,
			);
			excalidrawApi.updateScene({ elements: nextElements });
			setElements(nextElements);
			return;
		}

		const draft = createOverlayElementDraft(
			'prototype',
			sceneCenter,
			prototype as unknown as Record<string, unknown>,
		);
		const converted = convertToExcalidrawElements([draft as never]);
		excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
	};

	const sendMessage = async (options?: {
		contextModeOverride?: AssistantContextMode;
		promptOverride?: string;
		skipSelectionConfirmation?: boolean;
	}) => {
		const text = (options?.promptOverride ?? input).trim();
		if (!text || isChatLoading) return;

		const effectiveContextMode = options?.contextModeOverride ?? contextMode;
		const selectedIds = getSelectedElementIdsFromMap(selectedElementIds);
		if (
			!options?.skipSelectionConfirmation &&
			shouldConfirmSelectionForPrompt({
				contextMode: effectiveContextMode,
				prompt: text,
				selectionCount: selectedIds.length,
			})
		) {
			setPendingSelectionConfirmation({
				prompt: text,
				createdAt: new Date().toISOString(),
			});
			setInput('');
			return;
		}

		setPendingSelectionConfirmation(null);
		setChatError(null);
		setIsChatLoading(true);

		const userMessage: AssistantMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			createdAt: new Date().toISOString(),
		};
		const history = buildConversationHistory(messages);
		const requestSelectedIds = effectiveContextMode === 'selected' ? selectedIds : [];
		const prototypeContext = getPrototypeContextForRequest(effectiveContextMode);
		if (!options?.promptOverride) {
			setInput('');
		}

		try {
			if (!isSignedIn) {
				throw new Error('Sign in is required before using the assistant.');
			}
			const ensuredThread = currentThread ?? (await createThread());
			appendMessageToThread(ensuredThread.id, userMessage);
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.assistant.runs.$post(
				{
					json: {
						threadId: ensuredThread.id,
						canvasId,
						message: text,
						contextMode: effectiveContextMode,
						history,
						selectedElementIds: requestSelectedIds,
						prototypeContext,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				const body = await response.text();
				throw new Error(body || `Assistant request failed with status ${response.status}`);
			}

			const created = (await response.json()) as AssistantRunCreated;
			setRunProgress(createAssistantRunProgress(created));
			await streamAssistantRunEvents(created.runId, headers, (event) => {
				setRunProgress((current) =>
					current && current.runId === created.runId ? applyAssistantRunEvent(current, event) : current,
				);
				if (event.type === 'message.created' && event.data?.message) {
					appendMessageToThread(ensuredThread.id, event.data.message);
				}
				if (event.type === 'run.failed') {
					setChatError(event.data?.error ?? 'Assistant run failed');
				}
			});
			const [run, tasks, artifacts] = await Promise.all([
				fetchAssistantRun(created.runId, headers),
				fetchAssistantRunTasks(created.runId, headers),
				fetchAssistantRunArtifacts(created.runId, headers),
			]);
			setRunProgress((current) =>
				current && current.runId === created.runId
					? reconcileAssistantRunProgress(current, {
							status: run.status,
							error: run.error,
							tasks,
							artifacts,
						})
					: current,
			);
		} catch (error) {
			setChatError(error instanceof Error ? error.message : 'Assistant request failed');
		} finally {
			setIsChatLoading(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 overflow-hidden rounded-[12px] border border-stone-200 bg-stone-50 shadow-xl">
			<aside
				className={`flex min-h-0 shrink-0 flex-col border-r border-stone-200 bg-stone-50 transition-[width] duration-200 ${
					isHistoryCollapsed ? 'w-[60px]' : 'w-[286px]'
				}`}
			>
				<div className="border-b border-stone-200 px-3 py-2.5">
					<div className={`flex items-center ${isHistoryCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
						{isHistoryCollapsed ? null : (
							<div className="text-[11px] font-medium text-stone-500">
								History
							</div>
						)}
						<button
							type="button"
							onClick={() => setIsHistoryCollapsed((current) => !current)}
							className="group inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-transparent text-stone-500 transition-all duration-200 hover:border-stone-200 hover:bg-white hover:text-stone-900"
							aria-label={isHistoryCollapsed ? 'Expand chat history' : 'Collapse chat history'}
							title={isHistoryCollapsed ? 'Expand chat history' : 'Collapse chat history'}
						>
							<span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
								<span
									className={`absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 rounded-full bg-current/35 origin-center transition-all duration-200 ${
										isHistoryCollapsed ? 'scale-y-0 opacity-0' : 'scale-y-100 opacity-100'
									}`}
								/>
								<svg
									viewBox="0 0 12 12"
									className={`relative ml-1 h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
										isHistoryCollapsed ? 'rotate-180' : 'rotate-0'
									}`}
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M7.5 2.5 4 6l3.5 3.5" />
								</svg>
							</span>
						</button>
					</div>
					<button
						type="button"
						onClick={async () => {
							try {
								await createThread();
								setRunProgress(null);
								setInput('');
							} catch (error) {
								setChatError(error instanceof Error ? error.message : 'Failed to create thread');
							}
						}}
						className={`mt-2 ${PANEL_BUTTON} ${isHistoryCollapsed ? PANEL_BUTTON_ACTIVE : PANEL_BUTTON_IDLE} ${
							isHistoryCollapsed ? 'h-10 w-full rounded-[10px] px-0' : 'w-full justify-center'
						}`}
						title="Create a new chat"
					>
						{isHistoryCollapsed ? (
							<span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
								<span className="absolute h-px w-4 rounded-full bg-current" />
								<span className="absolute h-4 w-px rounded-full bg-current" />
							</span>
						) : (
							'New Chat'
						)}
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-auto p-2">
					<div className="space-y-1.5">
						{threads.map((thread) => {
							const isActive = thread.id === currentThread?.id;
							const displayTitle = getThreadDisplayTitle(thread);
							return (
								<div key={thread.id} className="group relative">
									<button
										type="button"
										onClick={() => setActiveThreadId(thread.id)}
										className={`text-left transition-colors ${
											isHistoryCollapsed
												? `flex h-10 w-full items-center justify-center rounded-[10px] border ${
														isActive
															? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
															: 'border-stone-200 bg-white text-stone-500 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]'
													}`
												: `flex w-full items-start rounded-[10px] border px-3 py-2.5 ${
														isActive
															? 'border-[#d7dafd] bg-[#f3f1ff]'
															: 'border-transparent bg-transparent hover:border-stone-200 hover:bg-white'
													}`
										}`}
									>
										{isHistoryCollapsed ? (
											<span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
												{getThreadMonogram(displayTitle)}
											</span>
											) : (
												<div className="min-w-0 flex-1 pr-7">
													<div className="flex items-center justify-between gap-3">
														<div className="truncate text-sm font-medium text-stone-900">
															{displayTitle}
														</div>
														<div className="shrink-0 text-[10px] text-stone-400">
															{formatThreadTimestamp(thread.updatedAt)}
														</div>
													</div>
													<div className="mt-1 truncate text-xs text-stone-500">
														{getThreadPreview(thread)}
													</div>
												</div>
										)}
									</button>
									{!isHistoryCollapsed && threads.length > 0 ? (
										<button
											type="button"
											onClick={async (event) => {
												event.stopPropagation();
												try {
													await removeThread(thread.id);
												} catch (error) {
													setChatError(
														error instanceof Error
															? error.message
															: 'Failed to delete thread',
													);
												}
											}}
											className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-stone-500 opacity-0 transition-all hover:bg-white hover:text-rose-600 group-hover:opacity-100"
											aria-label={`Delete ${thread.title}`}
											title={`Delete ${thread.title}`}
										>
											<svg
												viewBox="0 0 12 12"
												className="h-3 w-3"
												fill="none"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												aria-hidden="true"
											>
												<path d="M3 3l6 6" />
												<path d="M9 3 3 9" />
											</svg>
										</button>
									) : null}
								</div>
							);
						})}
						{threads.length === 0 ? (
							<div className="rounded-[10px] border border-dashed border-stone-200 bg-white px-3 py-4 text-xs text-stone-500">
								No saved chats for this canvas yet.
							</div>
						) : null}
					</div>
				</div>
			</aside>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-50">
					<div className="border-b border-stone-200 bg-white px-4 py-3">
						<div className="flex items-center justify-between gap-3">
						<div className="min-w-0 truncate text-[12px] text-stone-500">
								{messages.length} message{messages.length === 1 ? '' : 's'}
							</div>
						<div className="flex flex-wrap items-center gap-2">
							{selectionIndicator ? (
								<div
									className={`inline-flex h-10 items-center rounded-[10px] border px-3 text-xs ${
										contextMode === 'selected'
											? 'border-emerald-200 bg-emerald-50 text-emerald-700'
											: 'border-amber-200 bg-amber-50 text-amber-700'
									}`}
									title={selectionIndicator.detail}
								>
									{contextMode === 'selected'
										? `Using ${selectionIndicator.label.toLowerCase()}`
										: `${selectionIndicator.label}.`}
								</div>
							) : null}
							<select
								value={contextMode}
								onChange={(event) => setContextMode(event.target.value as 'all' | 'selected' | 'none')}
								className={`h-10 min-w-[210px] rounded-[10px] border bg-white px-3 py-2 text-sm ${PANEL_BUTTON_IDLE}`}
							>
								<option value="none">No canvas context</option>
								<option value="all">Whole canvas</option>
								<option value="selected">Selected only</option>
							</select>
							<button
								type="button"
								onClick={async () => {
									if (!currentThread) {
										return;
									}

									try {
										await removeThread(currentThread.id);
										setRunProgress(null);
										setInput('');
									} catch (error) {
										setChatError(
											error instanceof Error
												? error.message
												: 'Failed to clear thread',
										);
									}
								}}
								className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER} h-10`}
							>
								Clear Thread
							</button>
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-auto">
					<div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 py-5">
						{runProgress ? (
								<div className="rounded-[12px] border border-stone-200 bg-white px-4 py-3">
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-3">
										<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
											Run Status
										</div>
										<button
											type="button"
											onClick={() => setIsRunProgressExpanded((current) => !current)}
											className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 transition-colors hover:text-stone-900"
										>
											{isRunProgressExpanded ? 'Collapse' : 'Expand'}
										</button>
									</div>
									<div
										className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
											runProgress.status === 'failed'
												? 'bg-rose-100 text-rose-700'
												: runProgress.status === 'completed'
													? 'bg-emerald-100 text-emerald-700'
													: 'bg-stone-100 text-stone-600'
										}`}
									>
										{runProgress.status}
									</div>
								</div>
								<div className="mt-1 text-sm font-medium text-stone-900">
									{getAssistantRunProgressLabel(runProgress)}
								</div>
								{isRunProgressExpanded && runProgress.tasks.length > 0 ? (
									<div className="mt-3 space-y-2">
										{runProgress.tasks.map((task) => (
											<div
												key={task.id}
												className="flex items-center justify-between gap-3 rounded-[10px] bg-stone-50 px-3 py-2 text-xs"
											>
												<div className="text-stone-700">{task.title}</div>
												<div
													className={`font-semibold uppercase tracking-[0.14em] ${
														task.status === 'failed'
															? 'text-rose-700'
															: task.status === 'completed'
																? 'text-emerald-700'
																: task.status === 'running'
																	? 'text-[#4d55cc]'
																	: 'text-stone-500'
													}`}
												>
													{task.status}
												</div>
											</div>
										))}
									</div>
								) : null}
								{isRunProgressExpanded && runProgress.artifacts.length > 0 ? (
									<div className="mt-3 rounded-[10px] border border-stone-200 bg-stone-50 px-3 py-2">
										<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
											Artifacts
										</div>
										<div className="mt-2 flex flex-wrap gap-2">
											{runProgress.artifacts.map((artifact) => (
												<div
													key={artifact.id}
													className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700"
												>
													{artifact.title}
												</div>
											))}
										</div>
									</div>
								) : null}
							</div>
						) : null}

						{messages.length === 0 ? (
								<div className="rounded-[12px] border border-stone-200 bg-white px-4 py-4">
									<div className="text-[11px] font-medium text-stone-500">
										Try asking the canvas assistant to diagram, summarize, or transform your current selection.
									</div>
									<div className="mt-3 flex flex-wrap gap-2">
										<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900">
											Diagram the auth flow
										</div>
										<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900">
											Turn this into kanban tasks
										</div>
										<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900">
											Summarize this idea as markdown
										</div>
										<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900">
											Build a landing page prototype
										</div>
									</div>
							</div>
						) : (
							messages.map((message) => (
								<MessageCard
									key={message.id}
									message={message}
									elements={elements as unknown as CanvasElement[]}
									onInsertArtifact={insertArtifactOnCanvas}
									onInsertMarkdown={(nextMessage) => void insertMarkdownOnCanvas(nextMessage.content)}
									onInsertPrototype={(nextMessage) =>
										void insertPrototypeOnCanvas(buildPrototypeFromMessageContent(nextMessage.content))
									}
									onInsertRenderedDiagram={(diagramInput) =>
										void insertRenderedDiagramOnCanvas(diagramInput)
									}
									patchStates={assistantPatchStates}
									markdownPatchReviewStates={markdownPatchReviewStates}
									onChangeMarkdownAcceptedHunks={updateMarkdownPatchAcceptedHunks}
									onApplyPatch={(artifactKey, artifact, options) =>
										applyAssistantPatch(artifactKey, artifact, 'apply', options)
									}
									onUndoPatch={(artifactKey) => undoAssistantPatch(artifactKey)}
									onReapplyPatch={(artifactKey, artifact, options) =>
										applyAssistantPatch(artifactKey, artifact, 'reapply', options)
									}
								/>
							))
						)}
						{pendingSelectionConfirmation && selectionIndicator ? (
							<SelectionConfirmationCard
								prompt={pendingSelectionConfirmation.prompt}
								selectionLabel={selectionIndicator.label}
								onUseSelection={() => {
									setContextMode('selected');
									void sendMessage({
										contextModeOverride: 'selected',
										promptOverride: pendingSelectionConfirmation.prompt,
										skipSelectionConfirmation: true,
									});
								}}
								onContinueWithoutSelection={() => {
									void sendMessage({
										contextModeOverride: 'none',
										promptOverride: pendingSelectionConfirmation.prompt,
										skipSelectionConfirmation: true,
									});
								}}
							/>
						) : null}

						{isChatLoading && !runProgress ? (
							<div className="mr-auto rounded-[12px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
								Planning and running...
							</div>
						) : null}
					</div>
				</div>

				<div className="border-t border-stone-200 bg-stone-50 px-5 py-4">
					<div className="mx-auto w-full max-w-[1120px]">
						{chatError ? (
							<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
								{chatError}
							</div>
						) : null}
						{selectionIndicator && contextMode !== 'selected' ? (
							<div className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
								{selectionIndicator.label}. {selectionIndicator.detail}
							</div>
						) : null}
						<div className="rounded-[12px] border border-stone-200 bg-white p-3">
							<textarea
								value={input}
								onChange={(event) => setInput(event.target.value)}
								onKeyDown={(event) => {
									if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
										event.preventDefault();
										void sendMessage();
									}
								}}
								className="min-h-[72px] w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-stone-900 outline-none placeholder:text-stone-400"
								placeholder="Describe the result you want on the canvas..."
							/>
							<div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
								<div className="text-[11px] text-stone-500">Cmd/Ctrl+Enter to send</div>
								<button
									type="button"
									disabled={disabled}
									onClick={() => void sendMessage()}
									className={`${PANEL_BUTTON} ${
										disabled ? 'cursor-not-allowed border-stone-200 bg-stone-200 text-stone-400' : PANEL_BUTTON_ACTIVE
									} h-10 px-4`}
								>
									Send
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
