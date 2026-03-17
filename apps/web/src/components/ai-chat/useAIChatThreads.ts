import {
	createAssistantThread,
	deleteAssistantThread,
	fetchAssistantThreads,
	getRequiredAuthHeaders,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import type { AssistantMessage, AssistantThread } from '@ai-canvas/shared/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
	const [threads, setThreads] = useState<AssistantThread[]>([]);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [isThreadsLoading, setIsThreadsLoading] = useState(false);

	const currentThread = useMemo(
		() => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
		[activeThreadId, threads],
	);

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
						: (nextThreads[0]?.id ?? null),
				);
				setChatError(null);
			} catch (error) {
				if (!cancelled) {
					captureBrowserException(error, {
						tags: {
							area: 'ai_chat',
							action: 'load_threads',
						},
						extra: {
							canvasId,
						},
					});
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

	const appendMessageToThread = useCallback((threadId: string, message: AssistantMessage) => {
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
	}, []);

	const createThread = useCallback(
		async (title?: string) => {
			const headers = await getRequiredAuthHeaders(getToken);
			const thread = await createAssistantThread({ canvasId, title }, headers);
			setThreads((currentThreads) => [thread, ...currentThreads]);
			setActiveThreadId(thread.id);
			return thread;
		},
		[canvasId, getToken],
	);

	const removeThread = useCallback(
		async (threadId: string) => {
			const headers = await getRequiredAuthHeaders(getToken);
			await deleteAssistantThread(threadId, headers);
			let nextActiveThreadId: string | null = null;
			setThreads((currentThreads) => {
				const remainingThreads = currentThreads.filter((thread) => thread.id !== threadId);
				nextActiveThreadId = remainingThreads[0]?.id ?? null;
				return remainingThreads;
			});
			setActiveThreadId((current) => (current === threadId ? nextActiveThreadId : current));
		},
		[getToken],
	);

	return {
		threads,
		activeThreadId,
		setActiveThreadId,
		isThreadsLoading,
		currentThread,
		appendMessageToThread,
		createThread,
		removeThread,
	};
}
