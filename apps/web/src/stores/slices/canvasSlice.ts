// fallow-ignore-file circular-dependencies
import type { PersistenceState } from '@/lib/persistence/CanvasPersistenceCoordinator';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { StateCreator } from 'zustand';

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

	// Actions
	setExcalidrawApi: (api: ExcalidrawImperativeAPI | null) => void;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setAppState: (appState: Partial<AppState>) => void;
	setFiles: (files: BinaryFiles) => void;
	setPersistenceState: (state: PersistenceState) => void;
	setRemoteSaving: (isRemoteSaving: boolean) => void;
}

const INITIAL_APP_STATE: Partial<AppState> = {
	selectedElementIds: {},
	scrollX: 0,
	scrollY: 0,
};

export const createCanvasSlice: StateCreator<CanvasSlice, [], [], CanvasSlice> = (set) => ({
	excalidrawApi: null,
	elements: [],
	appState: INITIAL_APP_STATE,
	files: {},

	isSaving: false,
	isRemoteSaving: false,
	lastSaved: null,
	hasUnsavedChanges: false,

	setExcalidrawApi: (api) =>
		set((state) => (state.excalidrawApi === api ? state : { excalidrawApi: api })),
	setElements: (elements) => set({ elements }),
	setAppState: (appState) => set({ appState }),
	setFiles: (files) => set({ files }),
	setPersistenceState: ({ isSaving, lastSaved, hasUnsavedChanges }) =>
		set({ isSaving, lastSaved, hasUnsavedChanges }),
	setRemoteSaving: (isRemoteSaving) => set({ isRemoteSaving }),
});
