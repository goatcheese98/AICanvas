import type { AssistantMessage, GenerationMode } from '@ai-canvas/shared/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';

// Helper to create valid AssistantMessage
function createMessage(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
	return {
		id: crypto.randomUUID(),
		role: 'user',
		content: 'Test message',
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

interface ChatThread {
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

interface ChatSlice {
	messages: AssistantMessage[];
	chatThreads: ChatThread[];
	activeChatThreadId: string | null;
	isChatOpen: boolean;
	isChatLoading: boolean;
	chatError: string | null;
	aiProvider: 'claude' | 'gemini';
	contextMode: 'all' | 'selected' | 'none';
	generationMode: GenerationMode;
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

const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set) => ({
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

function createTestStore() {
	return create<ChatSlice>()((...args) => ({
		...createChatSlice(...args),
	}));
}

describe('chatSlice', () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
	});

	describe('initial state', () => {
		it('has empty messages array', () => {
			expect(store.getState().messages).toEqual([]);
		});

		it('has one default thread', () => {
			expect(store.getState().chatThreads).toHaveLength(1);
			expect(store.getState().chatThreads[0].title).toBe('New chat');
		});

		it('has null activeChatThreadId', () => {
			expect(store.getState().activeChatThreadId).toBeNull();
		});

		it('has default UI state', () => {
			expect(store.getState().isChatOpen).toBe(false);
			expect(store.getState().isChatLoading).toBe(false);
			expect(store.getState().chatError).toBeNull();
		});

		it('has default AI settings', () => {
			expect(store.getState().aiProvider).toBe('claude');
			expect(store.getState().contextMode).toBe('none');
			expect(store.getState().generationMode).toBe('chat');
		});
	});

	describe('createChatThread', () => {
		it('creates a new thread with default title', () => {
			const threadId = store.getState().createChatThread();
			expect(threadId).toBeDefined();
			expect(store.getState().chatThreads).toHaveLength(2);
			expect(store.getState().chatThreads[0].title).toBe('New chat');
		});

		it('creates a new thread with custom title', () => {
			store.getState().createChatThread('Custom title');
			expect(store.getState().chatThreads[0].title).toBe('Custom title');
		});

		it('sets the new thread as active', () => {
			const threadId = store.getState().createChatThread();
			expect(store.getState().activeChatThreadId).toBe(threadId);
		});

		it('clears messages when creating new thread', () => {
			store.getState().createChatThread();
			store.getState().addMessage(createMessage({ content: 'Hello' }));
			expect(store.getState().messages).toHaveLength(1);

			store.getState().createChatThread();
			expect(store.getState().messages).toHaveLength(0);
		});

		it('clears chat error when creating new thread', () => {
			store.getState().setChatError('Previous error');
			store.getState().createChatThread();
			expect(store.getState().chatError).toBeNull();
		});
	});

	describe('addMessage', () => {
		beforeEach(() => {
			store.getState().createChatThread();
		});

		it('adds a message to the active thread', () => {
			const message = createMessage({ content: 'Hello, assistant!' });
			store.getState().addMessage(message);
			expect(store.getState().messages).toHaveLength(1);
			expect(store.getState().messages[0].content).toBe('Hello, assistant!');
		});

		it('updates thread title from first user message', () => {
			const message = createMessage({
				content: 'This is a long message that should be truncated to forty characters',
			});
			store.getState().addMessage(message);
			expect(store.getState().chatThreads[0].title).toBe(
				'This is a long message that should be tr',
			);
		});

		it('does not update title if not first user message', () => {
			store.getState().addMessage(createMessage({ content: 'First message' }));
			store.getState().addMessage(createMessage({ role: 'assistant', content: 'Response' }));
			store
				.getState()
				.addMessage(createMessage({ content: 'Second message with different content' }));
			expect(store.getState().chatThreads[0].title).toBe('First message');
		});

		it('does not update title from assistant message', () => {
			store
				.getState()
				.addMessage(createMessage({ role: 'assistant', content: 'Assistant response' }));
			expect(store.getState().chatThreads[0].title).toBe('New chat');
		});
	});

	describe('clearMessages', () => {
		beforeEach(() => {
			store.getState().createChatThread();
		});

		it('clears all messages from active thread', () => {
			store.getState().addMessage(createMessage({ content: 'Hello' }));
			store.getState().addMessage(createMessage({ role: 'assistant', content: 'Hi there!' }));
			expect(store.getState().messages).toHaveLength(2);

			store.getState().clearMessages();
			expect(store.getState().messages).toHaveLength(0);
		});

		it('resets thread title to New chat', () => {
			store.getState().addMessage(createMessage({ content: 'Important discussion' }));
			expect(store.getState().chatThreads[0].title).toBe('Important discussion');

			store.getState().clearMessages();
			expect(store.getState().chatThreads[0].title).toBe('New chat');
		});
	});

	describe('deleteChatThread', () => {
		beforeEach(() => {
			store.getState().createChatThread('Thread 1');
			store.getState().createChatThread('Thread 2');
		});

		it('removes the specified thread', () => {
			const threadId = store.getState().chatThreads[0].id;
			store.getState().deleteChatThread(threadId);
			expect(store.getState().chatThreads.find((t) => t.id === threadId)).toBeUndefined();
		});

		it('switches to another thread when deleting active thread', () => {
			const activeId = store.getState().activeChatThreadId;
			store.getState().deleteChatThread(activeId!);
			expect(store.getState().activeChatThreadId).not.toBe(activeId);
			expect(store.getState().activeChatThreadId).toBeDefined();
		});

		it('keeps current thread when deleting different thread', () => {
			const activeId = store.getState().activeChatThreadId;
			const otherThreadId = store.getState().chatThreads.find((t) => t.id !== activeId)!.id;
			store.getState().deleteChatThread(otherThreadId);
			expect(store.getState().activeChatThreadId).toBe(activeId);
		});

		it('creates new thread when deleting last thread', () => {
			// Delete all threads
			const allIds = store.getState().chatThreads.map((t) => t.id);
			for (const id of allIds) {
				store.getState().deleteChatThread(id);
			}
			expect(store.getState().chatThreads).toHaveLength(1);
			expect(store.getState().chatThreads[0].title).toBe('New chat');
		});
	});

	describe('setActiveChatThread', () => {
		beforeEach(() => {
			store.getState().createChatThread('Thread 1');
			store.getState().addMessage(createMessage({ content: 'Message 1' }));
			store.getState().createChatThread('Thread 2');
			store.getState().addMessage(createMessage({ content: 'Message 2' }));
		});

		it('switches to specified thread', () => {
			const firstThreadId = store.getState().chatThreads[1].id;
			store.getState().setActiveChatThread(firstThreadId);
			expect(store.getState().activeChatThreadId).toBe(firstThreadId);
		});

		it('loads messages from switched thread', () => {
			const firstThreadId = store.getState().chatThreads[1].id;
			store.getState().setActiveChatThread(firstThreadId);
			expect(store.getState().messages).toHaveLength(1);
			expect(store.getState().messages[0].content).toBe('Message 1');
		});

		it('clears chat error when switching threads', () => {
			store.getState().setChatError('Some error');
			const otherThreadId = store
				.getState()
				.chatThreads.find((t) => t.id !== store.getState().activeChatThreadId)!.id;
			store.getState().setActiveChatThread(otherThreadId);
			expect(store.getState().chatError).toBeNull();
		});
	});

	describe('UI state actions', () => {
		it('setIsChatOpen toggles chat open state', () => {
			store.getState().setIsChatOpen(true);
			expect(store.getState().isChatOpen).toBe(true);
			store.getState().setIsChatOpen(false);
			expect(store.getState().isChatOpen).toBe(false);
		});

		it('setIsChatLoading toggles loading state', () => {
			store.getState().setIsChatLoading(true);
			expect(store.getState().isChatLoading).toBe(true);
		});

		it('setChatError sets error message', () => {
			store.getState().setChatError('Something went wrong');
			expect(store.getState().chatError).toBe('Something went wrong');
			store.getState().setChatError(null);
			expect(store.getState().chatError).toBeNull();
		});
	});

	describe('AI settings actions', () => {
		it('setAiProvider changes provider', () => {
			store.getState().setAiProvider('gemini');
			expect(store.getState().aiProvider).toBe('gemini');
			store.getState().setAiProvider('claude');
			expect(store.getState().aiProvider).toBe('claude');
		});

		it('setContextMode changes context mode', () => {
			store.getState().setContextMode('all');
			expect(store.getState().contextMode).toBe('all');
			store.getState().setContextMode('selected');
			expect(store.getState().contextMode).toBe('selected');
			store.getState().setContextMode('none');
			expect(store.getState().contextMode).toBe('none');
		});

		it('setGenerationMode changes generation mode', () => {
			store.getState().setGenerationMode('kanban');
			expect(store.getState().generationMode).toBe('kanban');
			store.getState().setGenerationMode('prototype');
			expect(store.getState().generationMode).toBe('prototype');
		});
	});
});

describe('chatSlice helper functions', () => {
	describe('summarizeThreadTitle', () => {
		it('returns New chat for empty content', () => {
			expect(summarizeThreadTitle('')).toBe('New chat');
			expect(summarizeThreadTitle('   ')).toBe('New chat');
		});

		it('truncates long content to 40 characters', () => {
			const longContent =
				'This is a very long message that should be truncated to forty characters';
			const result = summarizeThreadTitle(longContent);
			expect(result).toHaveLength(40);
			expect(result).toBe(longContent.slice(0, 40));
		});

		it('preserves short content', () => {
			expect(summarizeThreadTitle('Short message')).toBe('Short message');
		});

		it('normalizes whitespace', () => {
			expect(summarizeThreadTitle('Message   with   extra   spaces')).toBe(
				'Message with extra spaces',
			);
		});
	});
});
