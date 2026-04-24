import {
	areBinaryFilesEquivalent,
	areExcalidrawAppStatesEquivalent,
	areExcalidrawElementsEquivalent,
} from '@/lib/excalidraw-scene-equality';
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
	isRemoteSaving: boolean;
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
	setRemoteSaving: (isRemoteSaving: boolean) => void;
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
	isRemoteSaving: false,
	lastSaved: null,
	hasUnsavedChanges: false,

	savedNavigationState: null,

	setExcalidrawApi: (api) =>
		set((state) => (state.excalidrawApi === api ? state : { excalidrawApi: api })),
	setElements: (elements) =>
		set((state) =>
			areExcalidrawElementsEquivalent(state.elements, elements) ? state : { elements },
		),
	setAppState: (appState) =>
		set((state) =>
			areExcalidrawAppStatesEquivalent(state.appState, appState) ? state : { appState },
		),
	setFiles: (files) =>
		set((state) => (areBinaryFilesEquivalent(state.files, files) ? state : { files })),
	setPersistenceState: ({ isSaving, lastSaved, hasUnsavedChanges }) =>
		set({ isSaving, lastSaved, hasUnsavedChanges }),
	setRemoteSaving: (isRemoteSaving) => set({ isRemoteSaving }),
	saveNavigationState: (state) => set({ savedNavigationState: state }),
	clearNavigationState: () => set({ savedNavigationState: null }),
});
