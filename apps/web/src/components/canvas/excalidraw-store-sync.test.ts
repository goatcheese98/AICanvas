import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/store';
import { updateSceneAndSyncAppStore } from './excalidraw-store-sync';

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
				selectedElementIds: { 'overlay-1': true },
				viewModeEnabled: true,
				viewBackgroundColor: '#f7f8fb',
				zoom: { value: 1 },
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
});
