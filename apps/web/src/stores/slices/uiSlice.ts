// fallow-ignore-file circular-dependencies
import type { StateCreator } from 'zustand';

interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
}

export interface UiSlice {
	// UI state
	isSidebarOpen: boolean;
	activePanel: 'none' | 'chat' | 'assets' | 'search' | 'collab';
	toasts: Toast[];
	expandedOverlayId: string | null;

	// Actions
	setIsSidebarOpen: (open: boolean) => void;
	setActivePanel: (panel: UiSlice['activePanel']) => void;
	addToast: (toast: Omit<Toast, 'id'>) => void;
	removeToast: (id: string) => void;
	openExpandedOverlay: (overlayId: string) => void;
	closeExpandedOverlay: () => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
	isSidebarOpen: false,
	activePanel: 'none',
	toasts: [],
	expandedOverlayId: null,

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
	openExpandedOverlay: (overlayId) => set({ expandedOverlayId: overlayId }),
	closeExpandedOverlay: () => set({ expandedOverlayId: null }),
});
