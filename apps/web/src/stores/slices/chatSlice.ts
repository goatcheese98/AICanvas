import type { StateCreator } from 'zustand';
import type { AssistantMessage, GenerationMode } from '@ai-canvas/shared/types';
import type { AppStore } from '../store';

export interface ChatSlice {
	// Chat state
	messages: AssistantMessage[];
	isChatOpen: boolean;
	isChatLoading: boolean;
	chatError: string | null;
	aiProvider: 'claude' | 'gemini';
	contextMode: 'all' | 'selected';
	generationMode: GenerationMode;

	// Actions
	addMessage: (message: AssistantMessage) => void;
	clearMessages: () => void;
	setIsChatOpen: (open: boolean) => void;
	setIsChatLoading: (loading: boolean) => void;
	setChatError: (error: string | null) => void;
	setAiProvider: (provider: 'claude' | 'gemini') => void;
	setContextMode: (mode: 'all' | 'selected') => void;
	setGenerationMode: (mode: GenerationMode) => void;
}

export const createChatSlice: StateCreator<AppStore, [], [], ChatSlice> = (set) => ({
	messages: [],
	isChatOpen: false,
	isChatLoading: false,
	chatError: null,
	aiProvider: 'claude',
	contextMode: 'all',
	generationMode: 'chat',

	addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
	clearMessages: () => set({ messages: [] }),
	setIsChatOpen: (open) => set({ isChatOpen: open }),
	setIsChatLoading: (loading) => set({ isChatLoading: loading }),
	setChatError: (error) => set({ chatError: error }),
	setAiProvider: (provider) => set({ aiProvider: provider }),
	setContextMode: (mode) => set({ contextMode: mode }),
	setGenerationMode: (mode) => set({ generationMode: mode }),
});
