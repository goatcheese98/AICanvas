import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasCore } from './CanvasCore';

let latestExcalidrawProps: Record<string, unknown> | null = null;

vi.mock('@excalidraw/excalidraw', async () => {
	const React = await import('react');

	return {
		Excalidraw: (props: Record<string, unknown>) => {
			latestExcalidrawProps = props;

			React.useEffect(() => {
				const onReady = props.excalidrawAPI as ((api: unknown) => void) | undefined;
				onReady?.({} as never);
			}, [props.excalidrawAPI]);

			return <div data-testid="mock-excalidraw" />;
		},
	};
});

describe('CanvasCore', () => {
	beforeEach(() => {
		latestExcalidrawProps = null;
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

	it('stores fresh scene snapshots so overlay subscribers observe viewport and element changes', () => {
		const onSceneChange = vi.fn();
		const onSaveNeeded = vi.fn();

		render(
			<CanvasCore canvasId="canvas-1" onSceneChange={onSceneChange} onSaveNeeded={onSaveNeeded} />,
		);

		expect(latestExcalidrawProps).not.toBeNull();

		const sourceElements = [
			{
				id: 'overlay-1',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 200,
				height: 140,
				angle: 0,
			},
		] as unknown as readonly ExcalidrawElement[];
		const sourceAppState: {
			scrollX: number;
			scrollY: number;
			selectedElementIds: Record<string, boolean>;
			zoom: { value: number };
		} = {
			scrollX: -120,
			scrollY: 48,
			selectedElementIds: { 'overlay-1': true },
			zoom: { value: 1.5 },
		};
		const sourceFiles: Record<string, { id: string; mimeType: string }> = {
			fileA: { id: 'fileA', mimeType: 'image/png' },
		};

		act(() => {
			(
				latestExcalidrawProps?.onChange as (
					elements: readonly ExcalidrawElement[],
					appState: typeof sourceAppState,
					files: typeof sourceFiles,
				) => void
			)(sourceElements, sourceAppState, sourceFiles);
		});

		const state = useAppStore.getState();

		expect(state.elements).not.toBe(sourceElements);
		expect(state.appState).not.toBe(sourceAppState);
		expect(state.files).not.toBe(sourceFiles);
		expect(state.appState.selectedElementIds).not.toBe(sourceAppState.selectedElementIds);
		expect(state.appState.zoom).not.toBe(sourceAppState.zoom);
		expect(onSceneChange).toHaveBeenCalledWith(state.elements, state.appState, state.files);
		expect(onSaveNeeded).toHaveBeenCalledWith(state.elements, state.appState, state.files);

		sourceAppState.selectedElementIds['second-overlay'] = true;
		(sourceElements as ExcalidrawElement[]).push({
			id: 'overlay-2',
			type: 'rectangle',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			angle: 0,
		} as unknown as ExcalidrawElement);
		sourceFiles.fileB = { id: 'fileB', mimeType: 'image/jpeg' };

		expect(state.appState.selectedElementIds).toEqual({ 'overlay-1': true });
		expect(state.elements).toHaveLength(1);
		expect(state.files).toEqual({
			fileA: { id: 'fileA', mimeType: 'image/png' },
		});
	});

	it('ignores repeated Excalidraw API callbacks for the same instance', () => {
		render(<CanvasCore canvasId="canvas-1" />);

		expect(latestExcalidrawProps).not.toBeNull();

		const listener = vi.fn();
		const unsubscribe = useAppStore.subscribe(listener);
		const stableApi = { refresh: vi.fn() } as never;

		try {
			act(() => {
				(latestExcalidrawProps?.excalidrawAPI as (api: unknown) => void)(stableApi);
				(latestExcalidrawProps?.excalidrawAPI as (api: unknown) => void)(stableApi);
			});

			expect(useAppStore.getState().excalidrawApi).toBe(stableApi);
			expect(listener).toHaveBeenCalledTimes(1);
		} finally {
			unsubscribe();
		}
	});

	it('syncs live scene snapshots during active pointer interactions so overlays can track drag motion', () => {
		const onPointerUpdate = vi.fn();

		render(<CanvasCore canvasId="canvas-1" onPointerUpdate={onPointerUpdate} />);

		expect(latestExcalidrawProps).not.toBeNull();

		const liveElements = [
			{
				id: 'overlay-1',
				type: 'rectangle',
				x: 240,
				y: 180,
				width: 420,
				height: 300,
				angle: 0,
			},
		] as unknown as readonly ExcalidrawElement[];
		const liveAppState = {
			scrollX: -90,
			scrollY: 36,
			selectedElementIds: { 'overlay-1': true },
			zoom: { value: 1.2 },
		};
		const liveFiles = {
			fileA: { id: 'fileA', mimeType: 'image/png' },
		};
		const stableApi = {
			refresh: vi.fn(),
			getSceneElements: () => liveElements,
			getAppState: () => liveAppState,
			getFiles: () => liveFiles,
		} as never;

		act(() => {
			(latestExcalidrawProps?.excalidrawAPI as (api: unknown) => void)(stableApi);
		});

		act(() => {
			(
				latestExcalidrawProps?.onPointerUpdate as (payload: {
					pointer: { x: number; y: number };
					button: 'down' | 'up';
					pointersMap: Map<number, Readonly<{ x: number; y: number }>>;
				}) => void
			)({
				pointer: { x: 320, y: 240 },
				button: 'down',
				pointersMap: new Map([[1, { x: 320, y: 240 }]]),
			});
		});

		const state = useAppStore.getState();

		expect(onPointerUpdate).toHaveBeenCalledWith({
			pointer: { x: 320, y: 240 },
			button: 'down',
			pointersMap: new Map([[1, { x: 320, y: 240 }]]),
		});
		expect(state.elements).toEqual(liveElements);
		expect(state.elements).not.toBe(liveElements);
		expect(state.appState).toEqual(liveAppState);
		expect(state.appState).not.toBe(liveAppState);
		expect(state.files).toEqual(liveFiles);
		expect(state.files).not.toBe(liveFiles);
	});

	it('applies normalized scene changes before syncing ai-managed vector resizes', () => {
		const updateScene = vi.fn();
		const onSceneChange = vi.fn();
		const onSaveNeeded = vi.fn();
		const stableApi = {
			updateScene,
		} as never;

		render(
			<CanvasCore
				canvasId="canvas-1"
				onSceneChange={onSceneChange}
				onSaveNeeded={onSaveNeeded}
				normalizeSceneChange={(elements) =>
					elements.map((element) => ({
						...element,
						x: element.x + 40,
					})) as ExcalidrawElement[]
				}
			/>,
		);

		act(() => {
			(latestExcalidrawProps?.excalidrawAPI as (api: unknown) => void)(stableApi);
		});

		const sourceElements = [
			{
				id: 'vector-1',
				type: 'line',
				x: 10,
				y: 20,
				width: 100,
				height: 40,
				angle: 0,
			},
		] as unknown as readonly ExcalidrawElement[];
		const sourceAppState = {
			scrollX: 0,
			scrollY: 0,
			selectedElementIds: { 'vector-1': true },
			zoom: { value: 1 },
		};
		const sourceFiles = {};

		act(() => {
			(
				latestExcalidrawProps?.onChange as (
					elements: readonly ExcalidrawElement[],
					appState: typeof sourceAppState,
					files: typeof sourceFiles,
				) => void
			)(sourceElements, sourceAppState, sourceFiles);
		});

		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({
					id: 'vector-1',
					x: 50,
				}),
			],
			appState: {
				selectedElementIds: { 'vector-1': true },
			},
		});
		expect(onSceneChange).not.toHaveBeenCalled();
		expect(onSaveNeeded).not.toHaveBeenCalled();
	});
});
