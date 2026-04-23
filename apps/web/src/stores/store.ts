import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { type CanvasSlice, createCanvasSlice } from './slices/canvasSlice';
import { type ChatSlice, type ChatThread, createChatSlice } from './slices/chatSlice';
import { type UiSlice, createUiSlice } from './slices/uiSlice';

type AppStore = CanvasSlice & ChatSlice & UiSlice;

function coercePersistedThreads(state: Partial<AppStore>, fallbackThreads: ChatThread[]) {
	if (Array.isArray(state.chatThreads) && state.chatThreads.length > 0) {
		return state.chatThreads;
	}

	if (Array.isArray(state.messages) && state.messages.length > 0) {
		return [
			{
				...fallbackThreads[0],
				title:
					state.messages[0]?.role === 'user'
						? state.messages[0].content.slice(0, 40)
						: 'Recovered chat',
				messages: state.messages,
				updatedAt: state.messages.at(-1)?.createdAt ?? fallbackThreads[0].updatedAt,
			},
		];
	}

	return fallbackThreads;
}

export const useAppStore = create<AppStore>()(
	persist(
		(...a) => ({
			...createCanvasSlice(...a),
			...createChatSlice(...a),
			...createUiSlice(...a),
		}),
		{
			name: 'ai-canvas-app-store',
			storage: createJSONStorage(() => localStorage),
			merge: (persistedState, currentState) => {
				const persisted = (persistedState ?? {}) as Partial<AppStore>;
				const chatThreads = coercePersistedThreads(persisted, currentState.chatThreads);
				const activeChatThreadId =
					typeof persisted.activeChatThreadId === 'string' &&
					chatThreads.some((thread) => thread.id === persisted.activeChatThreadId)
						? persisted.activeChatThreadId
						: (chatThreads[0]?.id ?? currentState.activeChatThreadId);
				const messages =
					chatThreads.find((thread) => thread.id === activeChatThreadId)?.messages ??
					persisted.messages ??
					currentState.messages;

				return {
					...currentState,
					...persisted,
					chatThreads,
					activeChatThreadId,
					messages,
				};
			},
			partialize: (state) => ({
				messages: state.messages,
				chatThreads: state.chatThreads,
				activeChatThreadId: state.activeChatThreadId,
				isChatOpen: state.isChatOpen,
				aiProvider: state.aiProvider,
				contextMode: state.contextMode,
				generationMode: state.generationMode,
			}),
		},
	),
);
