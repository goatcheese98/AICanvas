import {
	api,
	fetchAssistantRun,
	fetchAssistantRunArtifacts,
	fetchAssistantRunTasks,
	getRequiredAuthHeaders,
	streamAssistantRunEvents,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import type {
	AssistantArtifact,
	AssistantMessage,
	AssistantRunCreated,
	AssistantThread,
} from '@ai-canvas/shared/types';
import { useCallback, useState } from 'react';
import { getAIChatCommandMenuState, resolveAIChatRequest } from './ai-chat-command-helpers';
import { AFFIRMATIVE_PATCH_REPLY, NEGATIVE_PATCH_REPLY } from './ai-chat-constants';
import { buildConversationHistory } from './ai-chat-helpers';
import type { AssistantPatchApplyState, PatchArtifactDescriptor } from './ai-chat-types';
import {
	type AssistantRunProgress,
	applyAssistantRunEvent,
	createAssistantRunProgress,
	reconcileAssistantRunProgress,
} from './run-progress';
import { getSelectedElementIdsFromMap } from './selection-context';

export function useAIChatRunController({
	canvasId,
	getToken,
	isSignedIn,
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
	applyAssistantPatch,
	appendLocalAssistantMessage,
}: {
	canvasId: string;
	getToken: () => Promise<string | null>;
	isSignedIn: boolean | undefined;
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
	applyAssistantPatch: (
		artifactKey: string,
		artifact: AssistantArtifact,
		mode?: 'apply' | 'reapply',
		options?: { markdownContentOverride?: string },
	) => boolean;
	appendLocalAssistantMessage: (content: string) => void;
}) {
	const [runProgress, setRunProgressState] = useState<AssistantRunProgress | null>(null);
	const [isRunProgressExpanded, setIsRunProgressExpanded] = useState(true);

	// Helper to update run progress and sync UI state (derived state pattern)
	const setRunProgress = useCallback(
		(
			value:
				| AssistantRunProgress
				| null
				| ((prev: AssistantRunProgress | null) => AssistantRunProgress | null),
		) => {
			setRunProgressState((prev) => {
				const next = typeof value === 'function' ? value(prev) : value;
				// Sync expanded state based on run status
				if (next) {
					if (next.status === 'queued' || next.status === 'running') {
						setIsRunProgressExpanded(true);
					} else {
						setIsRunProgressExpanded(false);
					}
				}
				return next;
			});
		},
		[],
	);

	const sendMessage = async (options?: {
		promptOverride?: string;
	}) => {
		const rawText = options?.promptOverride ?? input;
		const text = rawText.trim();
		if (!text || isChatLoading) {
			return;
		}

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

		const requestSelectedIds = getSelectedElementIdsFromMap(selectedElementIds);
		const resolvedRequest = resolveAIChatRequest(text, requestSelectedIds.length);
		const menuState = getAIChatCommandMenuState(text);
		if (text.trimStart().startsWith('/') && resolvedRequest.commands.length === 0) {
			setChatError('Unknown slash command. Try /select, /selectall, /raster, /vector, or /svg.');
			return;
		}
		if (
			resolvedRequest.commands.some((command) => command.name === 'select') &&
			requestSelectedIds.length === 0
		) {
			setChatError('There is no current selection to use. Select an item or use /selectall.');
			return;
		}
		if (resolvedRequest.commands.length > 0 && !resolvedRequest.prompt) {
			setChatError('Add a prompt after the command, for example "/select rewrite this".');
			return;
		}

		const effectiveContextMode = resolvedRequest.contextMode;
		const effectiveModeHint = resolvedRequest.modeHint;

		setChatError(null);
		setIsChatLoading(true);

		const userMessage: AssistantMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: resolvedRequest.prompt,
			createdAt: new Date().toISOString(),
		};
		const history = buildConversationHistory(messages);
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
						message: resolvedRequest.prompt,
						contextMode: effectiveContextMode,
						modeHint: effectiveModeHint,
						history,
						selectedElementIds: requestSelectedIds,
					},
				},
				{ headers },
			);

			if (!response.ok) {
				const body = await response.text();
				throw new Error(body || `Assistant request failed with status ${response.status}`);
			}

			const created = (await response.json()) as AssistantRunCreated;
			// Set initial progress and expand the UI
			setRunProgressState(createAssistantRunProgress(created));
			setIsRunProgressExpanded(true);
			await streamAssistantRunEvents(created.runId, headers, (event) => {
				// Update progress - use wrapper to sync expanded state
				setRunProgress((current) =>
					current && current.runId === created.runId
						? applyAssistantRunEvent(current, event)
						: current,
				);
				if (event.type === 'message.created' && event.data?.message) {
					appendMessageToThread(ensuredThread.id, event.data.message);
				}
				if (event.type === 'run.failed') {
					captureBrowserException(new Error(event.data?.error ?? 'Assistant run failed'), {
						tags: {
							area: 'ai_chat',
							action: 'run_failed_event',
						},
						extra: {
							canvasId,
							runId: created.runId,
							contextMode: effectiveContextMode,
						},
					});
					setChatError(event.data?.error ?? 'Assistant run failed');
				}
			});

			const [run, tasks, artifacts] = await Promise.all([
				fetchAssistantRun(created.runId, headers),
				fetchAssistantRunTasks(created.runId, headers),
				fetchAssistantRunArtifacts(created.runId, headers),
			]);
			// Use wrapper to sync expanded state based on final status
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
			captureBrowserException(error, {
				tags: {
					area: 'ai_chat',
					action: 'send_message',
				},
				extra: {
					canvasId,
					contextMode: effectiveContextMode,
					hasCurrentThread: Boolean(currentThread),
					messageLength: resolvedRequest.prompt.length,
					selectedElementCount: requestSelectedIds.length,
					commandCount: resolvedRequest.commands.length,
					menuOpen: Boolean(menuState),
				},
			});
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
		sendMessage,
	};
}
