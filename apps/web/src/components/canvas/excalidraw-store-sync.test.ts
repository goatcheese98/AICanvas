import { useAppStore } from '@/stores/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type ExcalidrawSceneSnapshot,
	syncAppStoreSnapshot,
	updateSceneAndSyncAppStore,
} from './excalidraw-store-sync';

describe('updateSceneAndSyncAppStore', () => {
	beforeEach(() => {
		useAppStore.setState({
			elements: [],
			appState: {
				scrollX: 0,
				scrollY: 0,
				selectedElementIds: {},
			},
			files: {},
		});
	});

	it('syncs the merged Excalidraw app state back into the store after programmatic updates', () => {
		const state = {
			elements: [
				{
					id: 'overlay-1',
					type: 'rectangle',
					x: 24,
					y: 48,
					width: 320,
					height: 180,
					angle: 0,
				},
			],
			appState: {
				scrollX: -120,
				scrollY: 48,
				selectedElementIds: { 'overlay-1': true } as Record<string, true>,
				viewModeEnabled: true,
				viewBackgroundColor: '#f7f8fb',
				zoom: { value: 1 as never },
			},
			files: {
				fileA: { id: 'fileA', mimeType: 'image/png' },
			},
		};

		const api = {
			updateScene: vi.fn(
				(update: {
					elements?: typeof state.elements;
					appState?: Partial<typeof state.appState>;
				}) => {
					if (update.elements) {
						state.elements = update.elements;
					}
					if (update.appState) {
						state.appState = {
							...state.appState,
							...update.appState,
						};
					}
				},
			),
			getSceneElements: vi.fn(() => state.elements as never),
			getAppState: vi.fn(() => state.appState as never),
			getFiles: vi.fn(() => state.files as never),
		};

		updateSceneAndSyncAppStore(api as never, {
			appState: {
				scrollX: -240,
				scrollY: 96,
				zoom: { value: 1.5 as never },
			},
		});

		expect(useAppStore.getState().appState).toEqual({
			scrollX: -240,
			scrollY: 96,
			selectedElementIds: { 'overlay-1': true },
			viewModeEnabled: true,
			viewBackgroundColor: '#f7f8fb',
			zoom: { value: 1.5 },
		});
		expect(useAppStore.getState().files).toEqual(state.files);
		expect(useAppStore.getState().elements).toEqual(state.elements);
	});

	it('accepts snapshot overrides so callers do not need follow-up store writes', () => {
		const state = {
			elements: [] as Array<Record<string, unknown>>,
			appState: {
				scrollX: 0,
				scrollY: 0,
				selectedElementIds: {} as Record<string, true>,
				zoom: { value: 1 as never },
			},
			files: {} as Record<string, unknown>,
		};
		const api = {
			updateScene: vi.fn(),
			getSceneElements: vi.fn(() => state.elements as never),
			getAppState: vi.fn(() => state.appState as never),
			getFiles: vi.fn(() => state.files as never),
		};
		const nextFiles = {
			fileA: {
				id: 'fileA',
				mimeType: 'image/png',
				dataURL: 'data:image/png;base64,AAA',
				created: 1,
			},
		};

		updateSceneAndSyncAppStore(
			api as never,
			{
				appState: {
					selectedElementIds: { overlay: true } as Record<string, true>,
				},
			},
			{
				appState: {
					...state.appState,
					selectedElementIds: { overlay: true } as Record<string, true>,
				},
				files: nextFiles as never,
			},
		);

		expect(useAppStore.getState().appState).toEqual({
			...state.appState,
			selectedElementIds: { overlay: true },
		});
		expect(useAppStore.getState().files).toEqual(nextFiles);
	});
});

describe('syncAppStoreSnapshot', () => {
	beforeEach(() => {
		useAppStore.setState({
			elements: [],
			appState: {
				scrollX: 0,
				scrollY: 0,
				selectedElementIds: {},
			},
			files: {},
		});
	});

	it('skips redundant writes for equivalent snapshots', () => {
		const snapshot: ExcalidrawSceneSnapshot = {
			elements: [
				{
					id: 'overlay-1',
					type: 'rectangle',
					x: 24,
					y: 48,
					width: 320,
					height: 180,
					angle: 0,
					strokeWidth: 1,
					version: 1,
					versionNonce: 5,
					updated: 10,
					isDeleted: false,
				},
			] as never,
			appState: {
				scrollX: -120,
				scrollY: 48,
				selectedElementIds: { 'overlay-1': true } as Record<string, true>,
				zoom: { value: 1.5 as never },
			},
			files: {
				fileA: {
					id: 'fileA' as never,
					mimeType: 'image/png' as never,
					dataURL: 'data:image/png;base64,AAA' as never,
					created: 1,
				},
			},
		};

		syncAppStoreSnapshot(snapshot);
		const previousState = useAppStore.getState();
		const listener = vi.fn();
		const unsubscribe = useAppStore.subscribe(listener);

		try {
			syncAppStoreSnapshot({
				elements: [...snapshot.elements],
				appState: {
					...snapshot.appState,
					selectedElementIds: {
						...(snapshot.appState.selectedElementIds as Record<string, true>),
					},
					zoom: { value: (snapshot.appState.zoom as { value: never }).value },
				},
				files: { ...(snapshot.files as Record<string, unknown>) } as never,
			});
			expect(listener).not.toHaveBeenCalled();
			expect(useAppStore.getState()).toBe(previousState);
		} finally {
			unsubscribe();
		}
	});
});
