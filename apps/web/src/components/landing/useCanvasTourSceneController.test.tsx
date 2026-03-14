import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, BinaryFileData, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useAppStore } from '@/stores/store';
import {
	useCanvasTourSceneController,
	type CameraTarget,
	type CanvasSceneSnapshot,
	type TourTool,
} from './useCanvasTourSceneController';

function createElement(id: string, x = 0, y = 0): ExcalidrawElement {
	return {
		id,
		type: 'rectangle',
		x,
		y,
		width: 120,
		height: 80,
		angle: 0,
		strokeColor: '#111827',
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
		roughness: 0,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		seed: 1,
		index: 'a0' as never,
	} as ExcalidrawElement;
}

function createMockApi() {
	const state = {
		elements: [] as ExcalidrawElement[],
		appState: {
			scrollX: 0,
			scrollY: 0,
			selectedElementIds: {},
			zoom: { value: 1 },
		} as Partial<AppState>,
		files: {} as BinaryFiles,
	};

	return {
		updateScene: vi.fn((update: { elements?: ExcalidrawElement[]; appState?: Partial<AppState> }) => {
			if (update.elements) {
				state.elements = update.elements;
			}
			if (update.appState) {
				state.appState = {
					...state.appState,
					...update.appState,
				};
			}
		}),
		setActiveTool: vi.fn(),
		addFiles: vi.fn(),
		getSceneElements: vi.fn(() => state.elements),
		getSceneElementsIncludingDeleted: vi.fn(() => state.elements),
		getAppState: vi.fn(() => state.appState),
		getFiles: vi.fn(() => state.files),
		state,
	};
}

const initialCamera: CameraTarget = {
	x: 720,
	y: 450,
	zoom: 1,
};

const defaultScene = {
	elements: [createElement('default-note', 40, 50)],
	files: {},
};

const guideBaseline = {
	elements: [createElement('guide-note', 120, 140)],
	camera: initialCamera,
};

function renderSceneController(overrides?: {
	isGuideMode?: boolean;
	surfaceEpoch?: number;
	setActiveTool?: (tool: TourTool) => void;
}) {
	return renderHook((props: { isGuideMode: boolean; surfaceEpoch: number }) =>
		useCanvasTourSceneController({
			imageId: 'tour-image' as BinaryFileData['id'],
			defaultScene,
			guideBaseline,
			initialCamera,
			isGuideMode: props.isGuideMode,
			surfaceEpoch: props.surfaceEpoch,
			setActiveTool: overrides?.setActiveTool ?? vi.fn(),
		}),
	{
		initialProps: {
			isGuideMode: overrides?.isGuideMode ?? true,
			surfaceEpoch: overrides?.surfaceEpoch ?? 0,
		},
	});
}

beforeEach(() => {
	vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('skip image loading in tests'));
	useAppStore.setState({
		excalidrawApi: null,
		elements: [],
		appState: {
			scrollX: 0,
			scrollY: 0,
			selectedElementIds: {},
		},
		files: {},
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useCanvasTourSceneController', () => {
	it('stores explore-session snapshots from Excalidraw changes and restores them into initial surface data', () => {
		const setActiveTool = vi.fn();
		const { result, rerender } = renderSceneController({
			isGuideMode: false,
			setActiveTool,
		});

		const sceneElements = [createElement('explore-card', 320, 180)];
		const appState = {
			scrollX: -80,
			scrollY: 24,
			selectedElementIds: { 'explore-card': true },
			zoom: { value: 1.25 },
			activeTool: { type: 'rectangle', locked: false },
		} as unknown as Partial<AppState>;
		const files = {
			fileA: {
				id: 'fileA',
				mimeType: 'image/png',
				dataURL: 'data:image/png;base64,abc',
				created: 1,
			},
		} as unknown as BinaryFiles;

		act(() => {
			result.current.handleExcalidrawChange(sceneElements, appState as AppState, files);
		});

		expect(useAppStore.getState().elements).toEqual(sceneElements);
		expect(useAppStore.getState().files).toEqual(files);
		expect(setActiveTool).toHaveBeenLastCalledWith('rectangle');
		expect(result.current.getExploreSessionSnapshot()).toEqual({
			elements: expect.arrayContaining([
				expect.objectContaining({ id: 'explore-card', x: 320, y: 180 }),
			]),
			appState: expect.objectContaining({
				scrollX: -80,
				scrollY: 24,
				selectedElementIds: { 'explore-card': true },
			}),
			files,
		});

		const restoredSnapshot: CanvasSceneSnapshot = {
			elements: [createElement('restored-note', 480, 220)],
			appState: {
				scrollX: -140,
				scrollY: 40,
				zoom: { value: 1.4 as never },
			},
			files,
		};

		act(() => {
			result.current.setExploreSessionSnapshot(restoredSnapshot);
		});

		rerender({ isGuideMode: false, surfaceEpoch: 0 });

		expect(result.current.initialSurfaceData.elements).toEqual(restoredSnapshot.elements);
		expect(result.current.initialSurfaceData.appState).toEqual(
			expect.objectContaining({
				scrollX: -140,
				scrollY: 40,
				viewModeEnabled: false,
				viewBackgroundColor: '#f7f8fb',
			}),
		);
	});

	it('applies scene snapshots through the Excalidraw API and updates live camera state', () => {
		const { result } = renderSceneController();
		const api = createMockApi();

		act(() => {
			result.current.handleExcalidrawApiReady(api as never);
		});

		const snapshot: CanvasSceneSnapshot = {
			elements: [createElement('registered-layout', 600, 340)],
			appState: {
				scrollX: 0,
				scrollY: 0,
				selectedElementIds: { stale: true },
				zoom: { value: 1 as never },
			},
			files: {},
		};
		const cameraOverride: CameraTarget = {
			x: 900,
			y: 640,
			zoom: 1.5,
		};

		act(() => {
			result.current.applySceneSnapshot(snapshot, {
				preserveSelection: false,
				cameraOverride,
			});
		});

		expect(api.updateScene).toHaveBeenCalledWith(
			expect.objectContaining({
				elements: snapshot.elements,
				appState: expect.objectContaining({
					scrollX: -420,
					scrollY: -340,
					width: 1440,
					height: 900,
					selectedElementIds: {},
				}),
			}),
		);
		expect(useAppStore.getState().elements).toEqual(snapshot.elements);
		expect(result.current.liveCamera).toEqual(cameraOverride);
		expect(result.current.excalidrawMountKey).toBe('guide-0');
	});
});
