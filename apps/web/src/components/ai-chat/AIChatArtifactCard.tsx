import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { AssistantArtifact, CanvasElement } from '@ai-canvas/shared/types';
import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { describeAssistantArtifact, parseStoredAssistantAssetContent } from './assistant-artifacts';
import {
	PANEL_BUTTON,
	PANEL_BUTTON_DANGER,
	PANEL_BUTTON_IDLE,
} from './ai-chat-constants';
import { DiagramArtifactCard } from './AIChatDiagramArtifactCard';
import { PatchArtifactCard } from './AIChatPatchArtifactCard';
import { CodeSnippet } from './AIChatArtifactPrimitives';
import type {
	AssistantInsertionState,
	AssistantPatchApplyOptions,
	AssistantPatchApplyState,
	DiagramInsertInput,
	MarkdownPatchReviewState,
} from './ai-chat-types';

function StoredAssetPreview({ artifact }: { artifact: AssistantArtifact }) {
	const { getToken, isSignedIn } = useAuth();
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

	useEffect(() => {
		const storedAsset = parseStoredAssistantAssetContent(artifact.content);
		if (!isSignedIn || !storedAsset?.artifactId || !storedAsset.runId) {
			setPreviewUrl(null);
			setStatus('idle');
			return;
		}
		const runId = storedAsset.runId;
		const artifactId = storedAsset.artifactId;

		let cancelled = false;
		let objectUrl: string | null = null;
		setStatus('loading');

		void (async () => {
			try {
				const headers = await getRequiredAuthHeaders(async () => (await getToken?.()) ?? null);
				const { blob } = await fetchAssistantArtifactAsset(
					runId,
					artifactId,
					headers,
				);
				if (cancelled) {
					return;
				}

				objectUrl = URL.createObjectURL(blob);
				setPreviewUrl(objectUrl);
				setStatus('ready');
			} catch {
				if (!cancelled) {
					setPreviewUrl(null);
					setStatus('error');
				}
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [artifact.content, getToken, isSignedIn]);

	if (status === 'idle') {
		return null;
	}

	return (
		<div className="mb-3 overflow-hidden rounded-[10px] border border-stone-200 bg-white">
			{previewUrl ? (
				<img
					src={previewUrl}
					alt="Generated asset preview"
					className="block max-h-64 w-full object-contain"
				/>
			) : (
				<div className="flex h-40 items-center justify-center text-[11px] text-stone-500">
					{status === 'error' ? 'Preview unavailable' : 'Loading preview...'}
				</div>
			)}
		</div>
	);
}

export function ArtifactCard({
	artifact,
	artifactKey,
	elements,
	onInsertArtifact,
	insertionState,
	onUndoInsertedArtifact,
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
	onInsertArtifact?: (artifactKey: string, artifact: AssistantArtifact) => void;
	insertionState?: AssistantInsertionState;
	onUndoInsertedArtifact?: (artifactKey: string) => void;
	onInsertRenderedDiagram?: (artifactKey: string, input: DiagramInsertInput) => void;
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
	const isDiagram = artifact.type === 'mermaid' || artifact.type === 'd2';
	if (isDiagram) {
		return (
			<DiagramArtifactCard
				artifactKey={artifactKey}
				artifact={artifact}
				insertionState={insertionState}
				onUndoInsertedArtifact={onUndoInsertedArtifact}
				onInsertRenderedDiagram={onInsertRenderedDiagram}
			/>
		);
	}

	if (
		artifact.type === 'markdown-patch' ||
		artifact.type === 'kanban-patch' ||
		artifact.type === 'prototype-patch'
	) {
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
					<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500">
						Markdown
					</div>
					<CodeSnippet code={artifact.content} language="Markdown" compact />
					{onInsertArtifact ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{insertionState?.status === 'inserted' ? (
								<>
									<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
										Inserted Onto Canvas
									</div>
									{onUndoInsertedArtifact ? (
										<button
											type="button"
											onClick={() => onUndoInsertedArtifact(artifactKey)}
											className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
										>
											Undo Insert
										</button>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => onInsertArtifact(artifactKey, artifact)}
									className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
								>
									Insert On Canvas
								</button>
							)}
						</div>
					) : null}
				</div>
			);
		case 'kanban-ops':
			return (
				<div className="rounded-[10px] border border-indigo-200 bg-indigo-50 p-3">
					<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
						Kanban Ops
					</div>
					<CodeSnippet code={artifact.content} language="JSON" compact />
					{onInsertArtifact ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{insertionState?.status === 'inserted' ? (
								<>
									<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
										Inserted Onto Canvas
									</div>
									{onUndoInsertedArtifact ? (
										<button
											type="button"
											onClick={() => onUndoInsertedArtifact(artifactKey)}
											className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
										>
											Undo Insert
										</button>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => onInsertArtifact(artifactKey, artifact)}
									className="inline-flex h-8 items-center justify-center rounded-[7px] border border-indigo-300 bg-white px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100"
								>
									Insert On Canvas
								</button>
							)}
						</div>
					) : null}
				</div>
			);
		case 'prototype-files':
			return (
				<div className="rounded-[10px] border border-sky-200 bg-sky-50 p-3">
					<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-700">
						Prototype Files
					</div>
					<CodeSnippet code={artifact.content} language="JSON" compact />
					{onInsertArtifact ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{insertionState?.status === 'inserted' ? (
								<>
									<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
										Inserted Onto Canvas
									</div>
									{onUndoInsertedArtifact ? (
										<button
											type="button"
											onClick={() => onUndoInsertedArtifact(artifactKey)}
											className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
										>
											Undo Insert
										</button>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => onInsertArtifact(artifactKey, artifact)}
									className="inline-flex h-8 items-center justify-center rounded-[7px] border border-sky-300 bg-white px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-700 transition-colors hover:border-sky-400 hover:bg-sky-100"
								>
									Apply Prototype
								</button>
							)}
						</div>
					) : null}
				</div>
			);
		case 'image':
			return (
				<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-600">
					<StoredAssetPreview artifact={artifact} />
					<CodeSnippet code={describeAssistantArtifact(artifact)} language="Image" compact />
					{onInsertArtifact ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{insertionState?.status === 'inserted' ? (
								<>
									<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
										Inserted Onto Canvas
									</div>
									{onUndoInsertedArtifact ? (
										<button
											type="button"
											onClick={() => onUndoInsertedArtifact(artifactKey)}
											className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
										>
											Undo Insert
										</button>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => onInsertArtifact(artifactKey, artifact)}
									className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
								>
									Insert Image
								</button>
							)}
						</div>
					) : null}
				</div>
			);
		case 'image-vector':
			return (
				<div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
					<StoredAssetPreview artifact={artifact} />
					<CodeSnippet code={describeAssistantArtifact(artifact)} language="Vector Asset" compact />
					{onInsertArtifact ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{insertionState?.status === 'inserted' ? (
								<>
									<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
										Inserted Onto Canvas
									</div>
									{onUndoInsertedArtifact ? (
										<button
											type="button"
											onClick={() => onUndoInsertedArtifact(artifactKey)}
											className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
										>
											Undo Insert
										</button>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => onInsertArtifact(artifactKey, artifact)}
									className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
								>
									Insert Vector
								</button>
							)}
						</div>
					) : null}
				</div>
			);
		case 'layout-plan':
			return (
				<div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3">
					<details>
						<summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-700">
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
