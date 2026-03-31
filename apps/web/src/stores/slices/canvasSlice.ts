import type { PersistenceState } from '@/lib/persistence/CanvasPersistenceCoordinator';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { StateCreator } from 'zustand';
import type { AppStore } from '../store';

export interface CanvasNavigationState {
	scrollX: number;
	scrollY: number;
	zoomValue: number;
	selectedElementIds: Record<string, true>;
}

export interface CanvasSlice {
	// Canvas state
	excalidrawApi: ExcalidrawImperativeAPI | null;
	elements: readonly ExcalidrawElement[];
	appState: Partial<AppState>;
	files: BinaryFiles;

	// Persistence state
	isSaving: boolean;
	lastSaved: Date | null;
	hasUnsavedChanges: boolean;

	// Navigation restoration state (for returning from focused views)
	savedNavigationState: CanvasNavigationState | null;

	// Actions
	setExcalidrawApi: (api: ExcalidrawImperativeAPI | null) => void;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setAppState: (appState: Partial<AppState>) => void;
	setFiles: (files: BinaryFiles) => void;
	setPersistenceState: (state: PersistenceState) => void;
	saveNavigationState: (state: CanvasNavigationState) => void;
	clearNavigationState: () => void;
}

const INITIAL_APP_STATE: Partial<AppState> = {
	selectedElementIds: {},
	scrollX: 0,
	scrollY: 0,
};

export const createCanvasSlice: StateCreator<AppStore, [], [], CanvasSlice> = (set) => ({
	excalidrawApi: null,
	elements: [],
	appState: INITIAL_APP_STATE,
	files: {},

	isSaving: false,
	lastSaved: null,
	hasUnsavedChanges: false,

	savedNavigationState: null,

	setExcalidrawApi: (api) =>
		set((state) => (state.excalidrawApi === api ? state : { excalidrawApi: api })),
	setElements: (elements) => set({ elements }),
	setAppState: (appState) => set({ appState }),
	setFiles: (files) => set({ files }),
	setPersistenceState: ({ isSaving, lastSaved, hasUnsavedChanges }) =>
		set({ isSaving, lastSaved, hasUnsavedChanges }),
	saveNavigationState: (state) => set({ savedNavigationState: state }),
	clearNavigationState: () => set({ savedNavigationState: null }),
});
