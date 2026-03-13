import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { CanvasCore } from './CanvasCore';
import { useAppStore } from '@/stores/store';

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
			<CanvasCore
				canvasId="canvas-1"
				onSceneChange={onSceneChange}
				onSaveNeeded={onSaveNeeded}
			/>,
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
			(latestExcalidrawProps?.onChange as (
				elements: readonly ExcalidrawElement[],
				appState: typeof sourceAppState,
				files: typeof sourceFiles,
			) => void)(sourceElements, sourceAppState, sourceFiles);
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
});
