import {
	createAssistantThread,
	deleteAssistantThread,
	fetchAssistantThreads,
	getRequiredAuthHeaders,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import type { AssistantMessage, AssistantThread } from '@ai-canvas/shared/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

export function useAIChatThreads({
	canvasId,
	getToken,
	isSignedIn,
	setChatError,
}: {
	canvasId: string;
	getToken: () => Promise<string | null>;
	isSignedIn: boolean | undefined;
	setChatError: (error: string | null) => void;
}) {
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const {
		data: threads = [],
		isLoading: isThreadsLoading,
		error: threadsError,
	} = useQuery<AssistantThread[]>({
		queryKey: ['assistantThreads', canvasId],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			return await fetchAssistantThreads(canvasId, headers);
		},
		enabled: isSignedIn === true,
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
	});

	// Handle errors from the query using ref comparison pattern
	const prevErrorRef = useRef<Error | null>(null);
	if (threadsError && threadsError !== prevErrorRef.current) {
		prevErrorRef.current = threadsError as Error;
		captureBrowserException(threadsError, {
			tags: {
				area: 'ai_chat',
				action: 'load_threads',
			},
			extra: {
				canvasId,
			},
		});
		setChatError(
			threadsError instanceof Error ? threadsError.message : 'Failed to load assistant threads',
		);
	}

	// Reset active thread when not signed in using derived state pattern
	if (!isSignedIn && activeThreadId !== null) {
		setActiveThreadId(null);
	}

	// Auto-select first thread using derived state with ref comparison
	const currentThread = useMemo(() => {
		const found = threads.find((thread) => thread.id === activeThreadId);
		if (found) return found;
		return threads[0] ?? null;
	}, [activeThreadId, threads]);

	// Auto-update activeThreadId when current thread changes using ref comparison
	const expectedThreadId = currentThread?.id ?? null;
	if (expectedThreadId !== activeThreadId) {
		setActiveThreadId(expectedThreadId);
	}

	// Local optimistic updates - maintain a local override layer
	const [localThreadOverrides, setLocalThreadOverrides] = useState<Map<string, AssistantThread>>(
		new Map(),
	);

	const effectiveThreads = useMemo(() => {
		return threads.map((thread) => localThreadOverrides.get(thread.id) ?? thread);
	}, [threads, localThreadOverrides]);

	const appendMessageToThread = useCallback(
		(threadId: string, message: AssistantMessage) => {
			setLocalThreadOverrides((prev) => {
				const next = new Map(prev);
				const existingThread = threads.find((t) => t.id === threadId);
				if (!existingThread) return prev;

				const currentThread = next.get(threadId) ?? existingThread;
				const nextMessages = [...currentThread.messages, message];
				next.set(threadId, {
					...currentThread,
					title:
						currentThread.title === 'New chat' && message.role === 'user'
							? message.content.trim().replace(/\s+/g, ' ').slice(0, 40) || currentThread.title
							: currentThread.title,
					messages: nextMessages,
					updatedAt: message.createdAt,
				});
				return next;
			});
		},
		[threads],
	);

	const createThread = useCallback(
		async (title?: string) => {
			const headers = await getRequiredAuthHeaders(getToken);
			const thread = await createAssistantThread({ canvasId, title }, headers);
			// Invalidate and refetch to get the new thread
			await queryClient.invalidateQueries({ queryKey: ['assistantThreads', canvasId] });
			setActiveThreadId(thread.id);
			// Clear local overrides for fresh state
			setLocalThreadOverrides(new Map());
			return thread;
		},
		[canvasId, getToken, queryClient],
	);

	const removeThread = useCallback(
		async (threadId: string) => {
			const headers = await getRequiredAuthHeaders(getToken);
			await deleteAssistantThread(threadId, headers);
			// Find remaining threads after removal
			const remainingThreads = threads.filter((thread) => thread.id !== threadId);
			const nextActiveThreadId = remainingThreads[0]?.id ?? null;
			setActiveThreadId((current) => (current === threadId ? nextActiveThreadId : current));
			// Invalidate and refetch
			await queryClient.invalidateQueries({ queryKey: ['assistantThreads', canvasId] });
			// Remove from local overrides if present
			setLocalThreadOverrides((prev) => {
				const next = new Map(prev);
				next.delete(threadId);
				return next;
			});
		},
		[canvasId, getToken, queryClient, threads],
	);

	return {
		threads: effectiveThreads,
		activeThreadId,
		setActiveThreadId,
		isThreadsLoading,
		currentThread:
			effectiveThreads.find((t) => t.id === activeThreadId) ?? effectiveThreads[0] ?? null,
		appendMessageToThread,
		createThread,
		removeThread,
	};
}
