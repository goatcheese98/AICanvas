import { useEffect, useState } from 'react';
import type {
	AssistantArtifact,
	AssistantContextMode,
	AssistantMessage,
	AssistantRunCreated,
	AssistantThread,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import {
	api,
	fetchAssistantRun,
	fetchAssistantRunArtifacts,
	fetchAssistantRunTasks,
	getRequiredAuthHeaders,
	streamAssistantRunEvents,
} from '@/lib/api';
import { renderCodeArtifactToSvg } from '@/lib/assistant/diagram-renderer';
import {
	applyAssistantRunEvent,
	createAssistantRunProgress,
	reconcileAssistantRunProgress,
	type AssistantRunProgress,
} from './run-progress';
import {
	AFFIRMATIVE_PATCH_REPLY,
	NEGATIVE_PATCH_REPLY,
} from './ai-chat-constants';
import {
	buildArtifactKey,
	buildConversationHistory,
} from './ai-chat-helpers';
import { getSelectedElementIdsFromMap, shouldConfirmSelectionForPrompt } from './selection-context';
import { getDiagramArtifactSource } from './assistant-artifacts';
import type {
	AssistantInsertionState,
	AssistantPatchApplyState,
	PatchArtifactDescriptor,
	PendingSelectionConfirmation,
} from './ai-chat-types';

export function useAIChatRunController({
	canvasId,
	getToken,
	isSignedIn,
	contextMode,
	selectedElementIds,
	input,
	setInput,
	isChatLoading,
	setIsChatLoading,
	setChatError,
	currentThread,
	messages,
	createThread,
	appendMessageToThread,
	latestPendingPatchArtifacts,
	assistantPatchStates,
	assistantInsertionStates,
	applyAssistantPatch,
	getPrototypeContextForRequest,
	appendLocalAssistantMessage,
	insertArtifactOnCanvas,
	insertRenderedDiagramOnCanvas,
	rememberInsertionState,
}: {
	canvasId: string;
	getToken: () => Promise<string | null>;
	isSignedIn: boolean | undefined;
	contextMode: AssistantContextMode;
	selectedElementIds: Record<string, boolean>;
	input: string;
	setInput: (value: string) => void;
	isChatLoading: boolean;
	setIsChatLoading: (value: boolean) => void;
	setChatError: (value: string | null) => void;
	currentThread: AssistantThread | null;
	messages: AssistantMessage[];
	createThread: (title?: string) => Promise<AssistantThread>;
	appendMessageToThread: (threadId: string, message: AssistantMessage) => void;
	latestPendingPatchArtifacts: PatchArtifactDescriptor[];
	assistantPatchStates: Record<string, AssistantPatchApplyState>;
	assistantInsertionStates: Record<string, AssistantInsertionState>;
	applyAssistantPatch: (
		artifactKey: string,
		artifact: AssistantArtifact,
		mode?: 'apply' | 'reapply',
		options?: { markdownContentOverride?: string },
	) => boolean;
	getPrototypeContextForRequest: (
		effectiveContextMode: AssistantContextMode,
	) => PrototypeOverlayCustomData | undefined;
	appendLocalAssistantMessage: (content: string) => void;
	insertArtifactOnCanvas: (artifact: AssistantArtifact) => Promise<AssistantInsertionState | null>;
	insertRenderedDiagramOnCanvas: (input: {
		title: string;
		svgMarkup: string;
		width: number;
		height: number;
		diagram: {
			language: 'mermaid' | 'd2';
			code: string;
		};
	}) => Promise<AssistantInsertionState | null>;
	rememberInsertionState: (artifactKey: string, insertionState: AssistantInsertionState) => void;
}) {
	const [runProgress, setRunProgress] = useState<AssistantRunProgress | null>(null);
	const [isRunProgressExpanded, setIsRunProgressExpanded] = useState(true);
	const [pendingSelectionConfirmation, setPendingSelectionConfirmation] =
		useState<PendingSelectionConfirmation>(null);

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
		if (!runProgress || runProgress.status !== 'completed') {
			return;
		}

		const latestAssistantMessage = [...messages]
			.reverse()
			.find((message) => message.role === 'assistant' && (message.artifacts?.length ?? 0) > 0);
		if (!latestAssistantMessage) {
			return;
		}

		const pendingArtifacts = (latestAssistantMessage.artifacts ?? [])
			.map((artifact, index) => ({
				artifact,
				artifactKey: buildArtifactKey(latestAssistantMessage.id, artifact, index),
			}))
			.filter(
				({ artifact, artifactKey }) =>
					(artifact.type === 'kanban-ops' ||
						artifact.type === 'markdown' ||
						artifact.type === 'prototype-files' ||
						artifact.type === 'mermaid' ||
						artifact.type === 'd2') &&
					!assistantInsertionStates[artifactKey],
			);

		if (pendingArtifacts.length === 0) {
			return;
		}

		let cancelled = false;

		void (async () => {
			for (const { artifact, artifactKey } of pendingArtifacts) {
				if (cancelled) {
					return;
				}

				try {
					const insertionState =
						artifact.type === 'mermaid' || artifact.type === 'd2'
							? await (async () => {
									const diagram = getDiagramArtifactSource(artifact);
									if (!diagram) {
										return null;
									}
									const rendered = await renderCodeArtifactToSvg({
										language: diagram.language,
										code: diagram.code,
										d2Variant: 'default',
									});
									return insertRenderedDiagramOnCanvas({
										title:
											diagram.language === 'mermaid' ? 'Mermaid Diagram' : 'D2 Diagram',
										svgMarkup: rendered.svgMarkup,
										width: rendered.width,
										height: rendered.height,
										diagram,
									});
							  })()
							: await insertArtifactOnCanvas(artifact);

					if (!cancelled && insertionState) {
						rememberInsertionState(artifactKey, insertionState);
					}
				} catch (error) {
					if (!cancelled) {
						setChatError(
							error instanceof Error
								? error.message
								: 'Failed to insert artifact onto the canvas',
						);
					}
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		assistantInsertionStates,
		insertArtifactOnCanvas,
		insertRenderedDiagramOnCanvas,
		messages,
		rememberInsertionState,
		runProgress,
		setChatError,
	]);

	const sendMessage = async (options?: {
		contextModeOverride?: AssistantContextMode;
		promptOverride?: string;
		skipSelectionConfirmation?: boolean;
	}) => {
		const rawText = options?.promptOverride ?? input;
		const text = rawText.trim();
		if (!text || isChatLoading) {
			return;
		}

		if (!pendingSelectionConfirmation) {
			const isAffirmativePatchReply = AFFIRMATIVE_PATCH_REPLY.test(text);
			const isNegativePatchReply = NEGATIVE_PATCH_REPLY.test(text);

			if (isAffirmativePatchReply || isNegativePatchReply) {
				if (!options?.promptOverride) {
					setInput('');
				}
				setChatError(null);

				if (latestPendingPatchArtifacts.length === 1) {
					const [{ artifact, artifactKey }] = latestPendingPatchArtifacts;
					if (isAffirmativePatchReply) {
						const patchState = assistantPatchStates[artifactKey];
						const didApply = applyAssistantPatch(
							artifactKey,
							artifact,
							patchState?.status === 'undone' ? 'reapply' : 'apply',
						);
						if (didApply) {
							appendLocalAssistantMessage(
								patchState?.status === 'undone'
									? 'Reapplied the pending patch to the selected canvas item.'
									: 'Applied the pending patch to the selected canvas item.',
							);
						}
					} else {
						appendLocalAssistantMessage(
							'Kept the pending patch as a suggestion. Nothing changed on the canvas.',
						);
					}
					return;
				}

				if (latestPendingPatchArtifacts.length > 1) {
					setChatError(
						'There are multiple pending patches right now. Use the specific patch button so we apply the right change.',
					);
					return;
				}

				appendLocalAssistantMessage(
					"There isn't a pending structured patch ready to apply right now. Use an Apply Patch button when one is shown, or ask me to regenerate the change.",
				);
				return;
			}
		}

		const effectiveContextMode = options?.contextModeOverride ?? contextMode;
		const requestSelectedIds = getSelectedElementIdsFromMap(selectedElementIds);
		if (
			!options?.skipSelectionConfirmation &&
			shouldConfirmSelectionForPrompt({
				contextMode: effectiveContextMode,
				prompt: text,
				selectionCount: requestSelectedIds.length,
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
					current && current.runId === created.runId
						? applyAssistantRunEvent(current, event)
						: current,
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

	return {
		runProgress,
		setRunProgress,
		isRunProgressExpanded,
		setIsRunProgressExpanded,
		pendingSelectionConfirmation,
		setPendingSelectionConfirmation,
		sendMessage,
	};
}
