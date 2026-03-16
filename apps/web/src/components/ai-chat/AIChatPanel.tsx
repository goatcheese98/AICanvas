import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { AssistantArtifact, AssistantMessage, CanvasElement } from '@ai-canvas/shared/types';
import { buildSelectionIndicator } from './selection-context';
import { CHAT_INPUT_MAX_HEIGHT } from './ai-chat-constants';
import { getLatestPendingPatchArtifacts } from './ai-chat-helpers';
import { MessageCard, SelectionConfirmationCard } from './AIChatArtifacts';
import { AIChatSidebar } from './AIChatSidebar';
import { AIChatHeader } from './AIChatHeader';
import { AIChatRunStatus } from './AIChatRunStatus';
import { AIChatComposer } from './AIChatComposer';
import { useAIChatThreads } from './useAIChatThreads';
import { useAIChatCanvasActions } from './useAIChatCanvasActions';
import { useAIChatRunController } from './useAIChatRunController';
import { captureBrowserException } from '@/lib/observability';
import { useAppStore } from '@/stores/store';

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
	const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
	const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);

	const {
		threads,
		activeThreadId,
		setActiveThreadId,
		isThreadsLoading,
		currentThread,
		appendMessageToThread,
		createThread,
		removeThread,
	} = useAIChatThreads({
		canvasId,
		getToken,
		isSignedIn,
		setChatError,
	});

	const messages = currentThread?.messages ?? [];
	const selectionIndicator = useMemo(
		() => buildSelectionIndicator(elements as unknown as CanvasElement[], selectedElementIds),
		[elements, selectedElementIds],
	);
	const disabled = useMemo(
		() => !input.trim() || isChatLoading || isThreadsLoading,
		[input, isChatLoading, isThreadsLoading],
	);

	const canvasActions = useAIChatCanvasActions({
		getToken,
		excalidrawApi,
		elements,
		selectedElementIds,
		setElements,
		setFiles,
		setChatError,
	});

	const latestPendingPatchArtifacts = useMemo(
		() => getLatestPendingPatchArtifacts(messages, canvasActions.assistantPatchStates),
		[messages, canvasActions.assistantPatchStates],
	);

	const appendLocalAssistantMessage = (content: string) => {
		if (!currentThread) {
			return;
		}

		appendMessageToThread(currentThread.id, {
			id: crypto.randomUUID(),
			role: 'assistant',
			content,
			createdAt: new Date().toISOString(),
		});
	};

	const {
		runProgress,
		setRunProgress,
		isRunProgressExpanded,
		setIsRunProgressExpanded,
		pendingSelectionConfirmation,
		setPendingSelectionConfirmation,
		sendMessage,
	} = useAIChatRunController({
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
		assistantPatchStates: canvasActions.assistantPatchStates,
		applyAssistantPatch: canvasActions.applyAssistantPatch,
		getPrototypeContextForRequest: canvasActions.getPrototypeContextForRequest,
		appendLocalAssistantMessage,
	});

	useEffect(() => {
		setRunProgress(null);
		setChatError(null);
		canvasActions.setAssistantPatchStates({});
		canvasActions.setAssistantInsertionStates({});
		canvasActions.setMarkdownPatchReviewStates({});
		setPendingSelectionConfirmation(null);
	}, [
		activeThreadId,
		canvasActions.setAssistantInsertionStates,
		canvasActions.setAssistantPatchStates,
		canvasActions.setMarkdownPatchReviewStates,
		setChatError,
		setPendingSelectionConfirmation,
		setRunProgress,
	]);

	useEffect(() => {
		if (!selectionIndicator) {
			setPendingSelectionConfirmation(null);
		}
	}, [selectionIndicator, setPendingSelectionConfirmation]);

	useEffect(() => {
		const textarea = chatTextareaRef.current;
		if (!textarea) {
			return;
		}

		textarea.style.height = '0px';
		const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), CHAT_INPUT_MAX_HEIGHT);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
	}, [input]);

	const handleCreateThread = async () => {
		try {
			await createThread();
			setRunProgress(null);
			setInput('');
		} catch (error) {
			captureBrowserException(error, {
				tags: {
					area: 'ai_chat',
					action: 'create_thread',
				},
				extra: {
					canvasId,
				},
			});
			setChatError(error instanceof Error ? error.message : 'Failed to create thread');
		}
	};

	const handleDeleteThread = async (threadId: string) => {
		try {
			await removeThread(threadId);
			if (threadId === currentThread?.id) {
				setRunProgress(null);
				setInput('');
			}
		} catch (error) {
			captureBrowserException(error, {
				tags: {
					area: 'ai_chat',
					action: 'delete_thread',
				},
				extra: {
					canvasId,
					threadId,
				},
			});
			setChatError(error instanceof Error ? error.message : 'Failed to delete thread');
		}
	};

	const handleInsertArtifact = async (artifactKey: string, artifact: AssistantArtifact) => {
		const insertionState = await canvasActions.insertArtifactOnCanvas(artifact);
		if (insertionState) {
			canvasActions.rememberInsertionState(artifactKey, insertionState);
		}
	};

	const handleInsertRenderedDiagram = async (
		artifactKey: string,
		inputForInsert: Parameters<typeof canvasActions.insertRenderedDiagramOnCanvas>[0],
	) => {
		const insertionState = await canvasActions.insertRenderedDiagramOnCanvas(inputForInsert);
		if (insertionState) {
			canvasActions.rememberInsertionState(artifactKey, insertionState);
		}
	};

	return (
		<div className="flex h-full min-h-0 overflow-hidden rounded-[12px] border border-stone-200 bg-stone-50 shadow-xl">
			<AIChatSidebar
				isHistoryCollapsed={isHistoryCollapsed}
				threads={threads}
				currentThreadId={currentThread?.id ?? null}
				onToggleCollapse={() => setIsHistoryCollapsed((current) => !current)}
				onCreateThread={() => void handleCreateThread()}
				onSelectThread={setActiveThreadId}
				onDeleteThread={(threadId) => void handleDeleteThread(threadId)}
			/>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-50">
				<AIChatHeader
					messagesCount={messages.length}
					selectionIndicator={selectionIndicator}
					contextMode={contextMode}
					onContextModeChange={setContextMode}
					onClearThread={() => {
						if (currentThread) {
							void handleDeleteThread(currentThread.id);
						}
					}}
				/>

				<div className="min-h-0 flex-1 overflow-auto">
					<div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3.5 px-4 py-4">
						<AIChatRunStatus
							runProgress={runProgress}
							isExpanded={isRunProgressExpanded}
							onToggleExpanded={() => setIsRunProgressExpanded((current) => !current)}
						/>

						{messages.length === 0 ? (
							<div className="rounded-[12px] border border-stone-200 bg-white px-4 py-4">
								<div className="text-[10px] font-medium text-stone-500">
									Try asking the canvas assistant to diagram, summarize, or transform your current
									selection.
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900">
										Diagram the auth flow
									</div>
									<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900">
										Turn this into kanban tasks
									</div>
									<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900">
										Summarize this idea as markdown
									</div>
									<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900">
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
									onInsertArtifact={(artifactKey, artifact) =>
										void handleInsertArtifact(artifactKey, artifact)
									}
									insertionStates={canvasActions.assistantInsertionStates}
									onUndoInsertedArtifact={canvasActions.removeInsertedArtifact}
									onInsertMarkdown={(nextMessage) =>
										void canvasActions.insertMarkdownOnCanvas(nextMessage.content)
									}
									onInsertPrototype={(nextMessage) =>
										void canvasActions.insertPrototypeOnCanvas(nextMessage.content)
									}
									onInsertRenderedDiagram={(artifactKey, inputForInsert) =>
										void handleInsertRenderedDiagram(artifactKey, inputForInsert)
									}
									patchStates={canvasActions.assistantPatchStates}
									markdownPatchReviewStates={canvasActions.markdownPatchReviewStates}
									onChangeMarkdownAcceptedHunks={canvasActions.updateMarkdownPatchAcceptedHunks}
									onApplyPatch={(artifactKey, artifact, options) =>
										canvasActions.applyAssistantPatch(artifactKey, artifact, 'apply', options)
									}
									onUndoPatch={(artifactKey) => canvasActions.undoAssistantPatch(artifactKey)}
									onReapplyPatch={(artifactKey, artifact, options) =>
										canvasActions.applyAssistantPatch(artifactKey, artifact, 'reapply', options)
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
							<div className="mr-auto rounded-[12px] border border-stone-200 bg-white px-4 py-3 text-[12px] text-stone-500">
								Planning and running...
							</div>
						) : null}
					</div>
				</div>

				<AIChatComposer
					chatError={chatError}
					selectionIndicator={selectionIndicator}
					contextMode={contextMode}
					textareaRef={chatTextareaRef}
					input={input}
					disabled={disabled}
					onInputChange={setInput}
					onSend={() => void sendMessage()}
				/>
			</div>
		</div>
	);
}
