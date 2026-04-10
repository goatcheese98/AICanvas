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
	AssistantContextMode,
	AssistantMessage,
	AssistantRunCreated,
	AssistantThread,
	PrototypeOverlayCustomData,
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

type ResolvedAIChatRequest = ReturnType<typeof resolveAIChatRequest>;
type PatchReplyKind = 'affirmative' | 'negative';

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
	getPrototypeContextForRequest,
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
	getPrototypeContextForRequest: (
		effectiveContextMode: AssistantContextMode,
	) => PrototypeOverlayCustomData | undefined;
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

	const clearInputIfNeeded = (promptOverride?: string) => {
		if (!promptOverride) {
			setInput('');
		}
	};

	const handlePatchReply = (text: string, promptOverride?: string) => {
		const patchReplyKind = getPatchReplyKind(text);
		if (!patchReplyKind) {
			return false;
		}

		clearInputIfNeeded(promptOverride);
		setChatError(null);

		if (latestPendingPatchArtifacts.length === 1) {
			handleSinglePendingPatchReply(patchReplyKind, latestPendingPatchArtifacts[0]);
			return true;
		}

		if (latestPendingPatchArtifacts.length > 1) {
			setChatError(
				'There are multiple pending patches right now. Use the specific patch button so we apply the right change.',
			);
			return true;
		}

		appendLocalAssistantMessage(
			"There isn't a pending structured patch ready to apply right now. Use an Apply Patch button when one is shown, or ask me to regenerate the change.",
		);
		return true;
	};

	const handleSinglePendingPatchReply = (
		patchReplyKind: PatchReplyKind,
		pendingPatch: PatchArtifactDescriptor | undefined,
	) => {
		if (!pendingPatch) {
			return;
		}

		if (patchReplyKind === 'negative') {
			appendLocalAssistantMessage(
				'Kept the pending patch as a suggestion. Nothing changed on the canvas.',
			);
			return;
		}

		const { artifact, artifactKey } = pendingPatch;
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
	};

	const getResolvedRequestError = (
		text: string,
		resolvedRequest: ResolvedAIChatRequest,
		requestSelectedIds: string[],
	) => {
		if (text.trimStart().startsWith('/') && resolvedRequest.commands.length === 0) {
			return 'Unknown slash command. Try /select, /selectall, /raster, /vector, or /svg.';
		}

		if (
			resolvedRequest.commands.some((command) => command.name === 'select') &&
			requestSelectedIds.length === 0
		) {
			return 'There is no current selection to use. Select an item or use /selectall.';
		}

		if (resolvedRequest.commands.length > 0 && !resolvedRequest.prompt) {
			return 'Add a prompt after the command, for example "/select rewrite this".';
		}

		return null;
	};

	const sendAssistantRun = async ({
		effectiveContextMode,
		effectiveModeHint,
		menuState,
		requestSelectedIds,
		resolvedRequest,
		userMessage,
	}: {
		effectiveContextMode: AssistantContextMode;
		effectiveModeHint: ResolvedAIChatRequest['modeHint'];
		menuState: ReturnType<typeof getAIChatCommandMenuState>;
		requestSelectedIds: string[];
		resolvedRequest: ResolvedAIChatRequest;
		userMessage: AssistantMessage;
	}) => {
		const history = buildConversationHistory(messages);
		const prototypeContext = getPrototypeContextForRequest(effectiveContextMode);

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
		setRunProgressState(createAssistantRunProgress(created));
		setIsRunProgressExpanded(true);

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
	};

	const sendMessage = async (options?: {
		promptOverride?: string;
	}) => {
		const rawText = options?.promptOverride ?? input;
		const text = rawText.trim();
		if (!text || isChatLoading) {
			return;
		}

		if (handlePatchReply(text, options?.promptOverride)) {
			return;
		}

		const requestSelectedIds = getSelectedElementIdsFromMap(selectedElementIds);
		const resolvedRequest = resolveAIChatRequest(text, requestSelectedIds.length);
		const menuState = getAIChatCommandMenuState(text);
		const requestError = getResolvedRequestError(text, resolvedRequest, requestSelectedIds);
		if (requestError) {
			setChatError(requestError);
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
		clearInputIfNeeded(options?.promptOverride);

		try {
			await sendAssistantRun({
				effectiveContextMode,
				effectiveModeHint,
				menuState,
				requestSelectedIds,
				resolvedRequest,
				userMessage,
			});
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

function getPatchReplyKind(text: string): PatchReplyKind | null {
	if (AFFIRMATIVE_PATCH_REPLY.test(text)) {
		return 'affirmative';
	}

	if (NEGATIVE_PATCH_REPLY.test(text)) {
		return 'negative';
	}

	return null;
}
