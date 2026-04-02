import { captureBrowserException } from '@/lib/observability';
import { useAppStore } from '@/stores/store';
import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { AIChatComposer } from './AIChatComposer';
import { AIChatEmptyState } from './AIChatEmptyState';
import { AIChatHeader } from './AIChatHeader';
import { AIChatMessageList } from './AIChatMessageList';
import { AIChatSidebar } from './AIChatSidebar';
import { getLatestPendingPatchArtifacts } from './ai-chat-helpers';
import type { AIChatPanelProps } from './ai-chat-panel-types';
import { useAIChatCanvasActions } from './useAIChatCanvasActions';
import { useAIChatPanelState } from './useAIChatPanelState';
import { useAIChatRunController } from './useAIChatRunController';
import { useAIChatThreads } from './useAIChatThreads';
import { useAutoResizeTextarea } from './useAutoResizeTextarea';

/**
 * AIChatPanelContent - AI chat for docked right panel.
 *
 * Same functionality as AIChatPanel but without floating panel styling
 * (no rounded corners, no shadow, no border) for use inside the shell's
 * right panel.
 */
export function AIChatPanelContent({ canvasId }: AIChatPanelProps) {
	const { getToken, isSignedIn } = useAuth();

	// App store selectors
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const isChatLoading = useAppStore((s) => s.isChatLoading);
	const chatError = useAppStore((s) => s.chatError);
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore(
		(s) => (s.appState.selectedElementIds ?? {}) as Record<string, boolean>,
	);
	const setElements = useAppStore((s) => s.setElements);
	const setFiles = useAppStore((s) => s.setFiles);
	const setIsChatLoading = useAppStore((s) => s.setIsChatLoading);
	const setChatError = useAppStore((s) => s.setChatError);

	// UI State hook
	const {
		input,
		setInput,
		isHistoryCollapsed,
		setIsHistoryCollapsed,
		selectionIndicator,
		isDisabled,
	} = useAIChatPanelState({
		elements,
		selectedElementIds,
	});

	// Textarea auto-resize
	const { textareaRef, resizeTextarea } = useAutoResizeTextarea();

	// Thread management
	const {
		threads,
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
	const latestMessage = messages.at(-1) ?? null;

	// Computed disabled state
	const disabled = isDisabled({ isChatLoading, isThreadsLoading });

	// Canvas actions
	const canvasActions = useAIChatCanvasActions({
		getToken,
		excalidrawApi,
		elements,
		selectedElementIds,
		setElements,
		setFiles,
		setChatError,
	});

	// Latest pending patch artifacts
	const latestPendingPatchArtifacts = useMemo(
		() => getLatestPendingPatchArtifacts(messages, canvasActions.assistantPatchStates),
		[messages, canvasActions.assistantPatchStates],
	);

	// Local assistant message append helper
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

	// Run controller
	const {
		runProgress,
		setRunProgress,
		isRunProgressExpanded,
		setIsRunProgressExpanded,
		sendMessage,
	} = useAIChatRunController({
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
		assistantPatchStates: canvasActions.assistantPatchStates,
		applyAssistantPatch: canvasActions.applyAssistantPatch,
		appendLocalAssistantMessage,
	});

	// Thread handlers with reset logic
	const handleCreateThread = async () => {
		try {
			await createThread();
			setRunProgress(null);
			setInput('');
			setChatError(null);
			canvasActions.setAssistantPatchStates({});
			canvasActions.setAssistantInsertionStates({});
			canvasActions.setMarkdownPatchReviewStates({});
		} catch (error) {
			captureBrowserException(error, {
				tags: { area: 'ai_chat', action: 'create_thread' },
				extra: { canvasId },
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
				tags: { area: 'ai_chat', action: 'delete_thread' },
				extra: { canvasId, threadId },
			});
			setChatError(error instanceof Error ? error.message : 'Failed to delete thread');
		}
	};

	const handleSelectThread = (threadId: string | null) => {
		setActiveThreadId(threadId);
		// Reset state on thread change (event-driven pattern instead of useEffect)
		setRunProgress(null);
		setChatError(null);
		canvasActions.setAssistantPatchStates({});
		canvasActions.setAssistantInsertionStates({});
		canvasActions.setMarkdownPatchReviewStates({});
	};

	// Input change handler with resize
	const handleInputChange = (value: string) => {
		setInput(value);
		// Use requestAnimationFrame to resize after DOM update
		requestAnimationFrame(resizeTextarea);
	};

	// Suggestion click handler
	const handleSuggestionClick = (suggestion: string) => {
		setInput(suggestion);
		requestAnimationFrame(resizeTextarea);
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-stone-50">
			<AIChatSidebar
				isHistoryCollapsed={isHistoryCollapsed}
				threads={threads}
				currentThreadId={currentThread?.id ?? null}
				onToggleCollapse={() => setIsHistoryCollapsed((current) => !current)}
				onCreateThread={() => void handleCreateThread()}
				onSelectThread={handleSelectThread}
				onDeleteThread={(threadId) => void handleDeleteThread(threadId)}
			/>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-50">
				<AIChatHeader
					messagesCount={messages.length}
					selectionIndicator={selectionIndicator}
					onClearThread={() => {
						if (currentThread) {
							void handleDeleteThread(currentThread.id);
						}
					}}
				/>

				<div className="min-h-0 flex-1 overflow-auto">
					{messages.length === 0 ? (
						<div className="flex w-full flex-col gap-3.5 px-4 py-4">
							<AIChatEmptyState onSuggestionClick={handleSuggestionClick} />
						</div>
					) : (
						<AIChatMessageList
							messages={messages}
							elements={elements}
							canvasActions={canvasActions}
							runProgress={runProgress}
							isRunProgressExpanded={isRunProgressExpanded}
							setIsRunProgressExpanded={setIsRunProgressExpanded}
							latestMessage={latestMessage}
							setChatError={setChatError}
							isChatLoading={isChatLoading}
						/>
					)}
				</div>

				<AIChatComposer
					chatError={chatError}
					selectionIndicator={selectionIndicator}
					textareaRef={textareaRef}
					input={input}
					disabled={disabled}
					onInputChange={handleInputChange}
					onSend={() => void sendMessage()}
				/>
			</div>
		</div>
	);
}
