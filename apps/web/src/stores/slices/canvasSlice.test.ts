import {
	areBinaryFilesEquivalent,
	areExcalidrawAppStatesEquivalent,
	areExcalidrawElementsEquivalent,
} from '@/lib/excalidraw-scene-equality';
import type { PersistenceState } from '@/lib/persistence/CanvasPersistenceCoordinator';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';

interface CanvasSlice {
	excalidrawApi: ExcalidrawImperativeAPI | null;
	elements: readonly ExcalidrawElement[];
	appState: Partial<AppState>;
	files: BinaryFiles;
	isSaving: boolean;
	isRemoteSaving: boolean;
	lastSaved: Date | null;
	hasUnsavedChanges: boolean;
	setExcalidrawApi: (api: ExcalidrawImperativeAPI) => void;
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

const createCanvasSlice: StateCreator<CanvasSlice, [], [], CanvasSlice> = (set) => ({
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
});

function createTestStore() {
	return create<CanvasSlice>()((...args) => ({
		...createCanvasSlice(...args),
	}));
}

describe('canvasSlice', () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
	});

	describe('initial state', () => {
		it('has null excalidrawApi', () => {
			expect(store.getState().excalidrawApi).toBeNull();
		});

		it('has empty elements array', () => {
			expect(store.getState().elements).toEqual([]);
		});

		it('has initial app state', () => {
			expect(store.getState().appState).toEqual(INITIAL_APP_STATE);
		});

		it('has empty files object', () => {
			expect(store.getState().files).toEqual({});
		});

		it('has default persistence state', () => {
			expect(store.getState().isSaving).toBe(false);
			expect(store.getState().isRemoteSaving).toBe(false);
			expect(store.getState().lastSaved).toBeNull();
			expect(store.getState().hasUnsavedChanges).toBe(false);
		});
	});

	describe('setExcalidrawApi', () => {
		it('sets the excalidraw API', () => {
			const mockApi = {} as ExcalidrawImperativeAPI;
			store.getState().setExcalidrawApi(mockApi);
			expect(store.getState().excalidrawApi).toBe(mockApi);
		});

		it('does not update state if same API is set', () => {
			const mockApi = {} as ExcalidrawImperativeAPI;
			store.getState().setExcalidrawApi(mockApi);
			const prevState = store.getState();
			store.getState().setExcalidrawApi(mockApi);
			expect(store.getState()).toBe(prevState);
		});

		it('updates state if different API is set', () => {
			const mockApi1 = {} as ExcalidrawImperativeAPI;
			const mockApi2 = { different: true } as unknown as ExcalidrawImperativeAPI;
			store.getState().setExcalidrawApi(mockApi1);
			const prevState = store.getState();
			store.getState().setExcalidrawApi(mockApi2);
			expect(store.getState()).not.toBe(prevState);
			expect(store.getState().excalidrawApi).toBe(mockApi2);
		});
	});

	describe('setElements', () => {
		it('sets elements array', () => {
			const mockElements = [{ id: 'element-1' }] as unknown as readonly ExcalidrawElement[];
			store.getState().setElements(mockElements);
			expect(store.getState().elements).toBe(mockElements);
		});

		it('replaces existing elements', () => {
			const mockElements1 = [{ id: 'element-1' }] as unknown as readonly ExcalidrawElement[];
			const mockElements2 = [{ id: 'element-2' }] as unknown as readonly ExcalidrawElement[];
			store.getState().setElements(mockElements1);
			store.getState().setElements(mockElements2);
			expect(store.getState().elements).toBe(mockElements2);
		});

		it('keeps state stable for equivalent element payloads', () => {
			const mockElements = [
				{
					id: 'element-1',
					type: 'rectangle',
					x: 10,
					y: 20,
					width: 100,
					height: 80,
					angle: 0,
					strokeWidth: 1,
					version: 1,
					versionNonce: 5,
					updated: 100,
					isDeleted: false,
				},
			] as unknown as readonly ExcalidrawElement[];
			store.getState().setElements(mockElements);
			const previousState = store.getState();

			store.getState().setElements([
				{
					...mockElements[0],
				},
			] as readonly ExcalidrawElement[]);

			expect(store.getState()).toBe(previousState);
		});
	});

	describe('setAppState', () => {
		it('sets app state', () => {
			const newAppState = { scrollX: 100, scrollY: 200 };
			store.getState().setAppState(newAppState);
			expect(store.getState().appState).toEqual(newAppState);
		});

		it('replaces entire app state', () => {
			store.getState().setAppState({ scrollX: 100 });
			store.getState().setAppState({ scrollY: 200 });
			expect(store.getState().appState).toEqual({ scrollY: 200 });
		});

		it('keeps state stable for equivalent app state payloads', () => {
			const appState = {
				scrollX: 100,
				scrollY: 200,
				selectedElementIds: { overlay: true } as Record<string, true>,
				zoom: { value: 1.5 as never },
			} as Partial<AppState>;
			store.getState().setAppState(appState);
			const previousState = store.getState();

			store.getState().setAppState({
				scrollX: 100,
				scrollY: 200,
				selectedElementIds: { overlay: true } as Record<string, true>,
				zoom: { value: 1.5 as never },
			} as Partial<AppState>);

			expect(store.getState()).toBe(previousState);
		});
	});

	describe('setFiles', () => {
		it('sets files object', () => {
			const mockFiles = {
				'file-1': {
					id: 'file-1',
					mimeType: 'image/png',
					dataURL: 'data:image/png;base64,test',
					created: Date.now(),
				},
			} as unknown as BinaryFiles;
			store.getState().setFiles(mockFiles);
			expect(store.getState().files).toBe(mockFiles);
		});

		it('replaces existing files', () => {
			const mockFiles1 = {
				'file-1': {
					id: 'file-1',
					mimeType: 'image/png',
					dataURL: 'data:image/png;base64,test',
					created: Date.now(),
				},
			} as unknown as BinaryFiles;
			const mockFiles2 = {
				'file-2': {
					id: 'file-2',
					mimeType: 'image/jpeg',
					dataURL: 'data:image/jpeg;base64,test',
					created: Date.now(),
				},
			} as unknown as BinaryFiles;
			store.getState().setFiles(mockFiles1);
			store.getState().setFiles(mockFiles2);
			expect(store.getState().files).toBe(mockFiles2);
		});

		it('keeps state stable for equivalent files payloads', () => {
			const mockFiles = {
				'file-1': {
					id: 'file-1',
					mimeType: 'image/png',
					dataURL: 'data:image/png;base64,test',
					created: 1,
				},
			} as unknown as BinaryFiles;
			store.getState().setFiles(mockFiles);
			const previousState = store.getState();

			store.getState().setFiles({
				'file-1': mockFiles['file-1'],
			} as BinaryFiles);

			expect(store.getState()).toBe(previousState);
		});
	});

	describe('setPersistenceState', () => {
		it('sets saving state', () => {
			store.getState().setPersistenceState({
				isSaving: true,
				lastSaved: null,
				hasUnsavedChanges: true,
			});
			expect(store.getState().isSaving).toBe(true);
			expect(store.getState().hasUnsavedChanges).toBe(true);
		});

		it('sets lastSaved date', () => {
			const now = new Date();
			store.getState().setPersistenceState({
				isSaving: false,
				lastSaved: now,
				hasUnsavedChanges: false,
			});
			expect(store.getState().lastSaved).toBe(now);
		});

		it('updates all persistence fields atomically', () => {
			const now = new Date();
			store.getState().setPersistenceState({
				isSaving: false,
				lastSaved: now,
				hasUnsavedChanges: false,
			});
			const state = store.getState();
			expect(state.isSaving).toBe(false);
			expect(state.lastSaved).toBe(now);
			expect(state.hasUnsavedChanges).toBe(false);
		});
	});

	describe('setRemoteSaving', () => {
		it('tracks remote save activity independently from local save state', () => {
			store.getState().setRemoteSaving(true);
			expect(store.getState().isRemoteSaving).toBe(true);

			store.getState().setRemoteSaving(false);
			expect(store.getState().isRemoteSaving).toBe(false);
		});
	});
});
