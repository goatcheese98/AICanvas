import type { StateCreator } from 'zustand';
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { PersistenceState } from '@/lib/persistence/CanvasPersistenceCoordinator';
import type { AppStore } from '../store';

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

	// Actions
	setExcalidrawApi: (api: ExcalidrawImperativeAPI) => void;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setAppState: (appState: Partial<AppState>) => void;
	setFiles: (files: BinaryFiles) => void;
	setPersistenceState: (state: PersistenceState) => void;
}

export const createCanvasSlice: StateCreator<AppStore, [], [], CanvasSlice> = (set) => ({
	excalidrawApi: null,
	elements: [],
	appState: {},
	files: {},

	isSaving: false,
	lastSaved: null,
	hasUnsavedChanges: false,

	setExcalidrawApi: (api) => set({ excalidrawApi: api }),
	setElements: (elements) => set({ elements }),
	setAppState: (appState) => set({ appState }),
	setFiles: (files) => set({ files }),
	setPersistenceState: ({ isSaving, lastSaved, hasUnsavedChanges }) =>
		set({ isSaving, lastSaved, hasUnsavedChanges }),
});
