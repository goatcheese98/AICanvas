// fallow-ignore-file circular-dependencies
import type { AssistantMessage, GenerationMode } from '@ai-canvas/shared/types';
import type { StateCreator } from 'zustand';

export interface ChatThread {
	id: string;
	title: string;
	messages: AssistantMessage[];
	createdAt: string;
	updatedAt: string;
}

function createThreadId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `thread_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createChatThread(title = 'New chat'): ChatThread {
	const now = new Date().toISOString();
	return {
		id: createThreadId(),
		title,
		messages: [],
		createdAt: now,
		updatedAt: now,
	};
}

function summarizeThreadTitle(content: string): string {
	const normalized = content.trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return 'New chat';
	}

	return normalized.slice(0, 40);
}

function ensureThreads(state: Pick<ChatSlice, 'chatThreads' | 'activeChatThreadId' | 'messages'>) {
	const existingThreads = state.chatThreads.length > 0 ? state.chatThreads : [createChatThread()];
	const activeThreadId =
		existingThreads.find((thread) => thread.id === state.activeChatThreadId)?.id ??
		existingThreads[0]?.id ??
		null;
	const activeMessages =
		existingThreads.find((thread) => thread.id === activeThreadId)?.messages ??
		state.messages ??
		[];

	return {
		chatThreads: existingThreads,
		activeChatThreadId: activeThreadId,
		messages: activeMessages,
	};
}

export interface ChatSlice {
	// Chat state
	messages: AssistantMessage[];
	chatThreads: ChatThread[];
	activeChatThreadId: string | null;
	isChatOpen: boolean;
	isChatLoading: boolean;
	chatError: string | null;
	aiProvider: 'claude' | 'gemini';
	contextMode: 'all' | 'selected' | 'none';
	generationMode: GenerationMode;

	// Actions
	addMessage: (message: AssistantMessage) => void;
	clearMessages: () => void;
	createChatThread: (title?: string) => string;
	deleteChatThread: (threadId: string) => void;
	setActiveChatThread: (threadId: string) => void;
	setIsChatOpen: (open: boolean) => void;
	setIsChatLoading: (loading: boolean) => void;
	setChatError: (error: string | null) => void;
	setAiProvider: (provider: 'claude' | 'gemini') => void;
	setContextMode: (mode: 'all' | 'selected' | 'none') => void;
	setGenerationMode: (mode: GenerationMode) => void;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set) => ({
	messages: [],
	chatThreads: [createChatThread()],
	activeChatThreadId: null,
	isChatOpen: false,
	isChatLoading: false,
	chatError: null,
	aiProvider: 'claude',
	contextMode: 'none',
	generationMode: 'chat',

	addMessage: (message) =>
		set((state) => {
			const ensured = ensureThreads(state);
			const activeThread = ensured.chatThreads.find(
				(thread) => thread.id === ensured.activeChatThreadId,
			);
			if (!activeThread) {
				return ensured;
			}

			const nextMessages = [...activeThread.messages, message];
			const updatedThread: ChatThread = {
				...activeThread,
				title:
					activeThread.title === 'New chat' && message.role === 'user'
						? summarizeThreadTitle(message.content)
						: activeThread.title,
				messages: nextMessages,
				updatedAt: new Date().toISOString(),
			};
			const nextThreads = ensured.chatThreads.map((thread) =>
				thread.id === updatedThread.id ? updatedThread : thread,
			);

			return {
				...ensured,
				chatThreads: nextThreads,
				messages: nextMessages,
			};
		}),
	clearMessages: () =>
		set((state) => {
			const ensured = ensureThreads(state);
			const activeThread = ensured.chatThreads.find(
				(thread) => thread.id === ensured.activeChatThreadId,
			);
			if (!activeThread) {
				return ensured;
			}

			const clearedThread: ChatThread = {
				...activeThread,
				title: 'New chat',
				messages: [],
				updatedAt: new Date().toISOString(),
			};

			return {
				...ensured,
				chatThreads: ensured.chatThreads.map((thread) =>
					thread.id === clearedThread.id ? clearedThread : thread,
				),
				messages: [],
			};
		}),
	createChatThread: (title = 'New chat') => {
		const thread = createChatThread(title);
		set((state) => {
			const ensured = ensureThreads(state);
			return {
				...ensured,
				chatThreads: [thread, ...ensured.chatThreads],
				activeChatThreadId: thread.id,
				messages: [],
				chatError: null,
			};
		});
		return thread.id;
	},
	deleteChatThread: (threadId) =>
		set((state) => {
			const ensured = ensureThreads(state);
			const remainingThreads = ensured.chatThreads.filter((thread) => thread.id !== threadId);
			const nextThreads = remainingThreads.length > 0 ? remainingThreads : [createChatThread()];
			const nextActiveThreadId =
				threadId === ensured.activeChatThreadId
					? (nextThreads[0]?.id ?? null)
					: (nextThreads.find((thread) => thread.id === ensured.activeChatThreadId)?.id ??
						nextThreads[0]?.id ??
						null);
			const nextMessages =
				nextThreads.find((thread) => thread.id === nextActiveThreadId)?.messages ?? [];

			return {
				...ensured,
				chatThreads: nextThreads,
				activeChatThreadId: nextActiveThreadId,
				messages: nextMessages,
			};
		}),
	setActiveChatThread: (threadId) =>
		set((state) => {
			const ensured = ensureThreads(state);
			const activeThread = ensured.chatThreads.find((thread) => thread.id === threadId);
			if (!activeThread) {
				return ensured;
			}

			return {
				...ensured,
				activeChatThreadId: activeThread.id,
				messages: activeThread.messages,
				chatError: null,
			};
		}),
	setIsChatOpen: (open) => set({ isChatOpen: open }),
	setIsChatLoading: (loading) => set({ isChatLoading: loading }),
	setChatError: (error) => set({ chatError: error }),
	setAiProvider: (provider) => set({ aiProvider: provider }),
	setContextMode: (mode) => set({ contextMode: mode }),
	setGenerationMode: (mode) => set({ generationMode: mode }),
});
