import type { StateCreator } from 'zustand';
import type { AppStore } from '../store';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
}

export interface UiSlice {
	// UI state
	isSidebarOpen: boolean;
	activePanel: 'none' | 'chat' | 'assets' | 'search' | 'collab';
	toasts: Toast[];

	// Actions
	setIsSidebarOpen: (open: boolean) => void;
	setActivePanel: (panel: UiSlice['activePanel']) => void;
	addToast: (toast: Omit<Toast, 'id'>) => void;
	removeToast: (id: string) => void;
}

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set) => ({
	isSidebarOpen: false,
	activePanel: 'none',
	toasts: [],

	setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
	setActivePanel: (panel) => set({ activePanel: panel }),
	addToast: (toast) =>
		set((state) => ({
			toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
		})),
	removeToast: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		})),
});
