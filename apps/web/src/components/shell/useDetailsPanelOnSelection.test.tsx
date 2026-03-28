import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDetailsPanelOnSelection } from './useDetailsPanelOnSelection';

describe('useDetailsPanelOnSelection', () => {
	beforeEach(() => {
		useAppStore.setState({
			elements: [],
			appState: {
				selectedElementIds: {},
			},
		});
	});

	it('does not open details when nothing is selected', () => {
		const onOpenDetails = vi.fn();

		renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(onOpenDetails).not.toHaveBeenCalled();
	});

	it('does not open details on initial mount with a preselected heavy resource', () => {
		const onOpenDetails = vi.fn();
		const kanbanElement = {
			id: 'kanban-1',
			type: 'rectangle',
			customData: { type: 'kanban', title: 'Test Board' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [kanbanElement],
			appState: {
				selectedElementIds: { 'kanban-1': true },
			},
		});

		renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(onOpenDetails).not.toHaveBeenCalled();
	});

	it('opens details when a kanban board becomes selected after mount', () => {
		const onOpenDetails = vi.fn();
		const kanbanElement = {
			id: 'kanban-1',
			type: 'rectangle',
			customData: { type: 'kanban', title: 'Test Board' },
		} as unknown as ExcalidrawElement;

		const { rerender } = renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		act(() => {
			useAppStore.setState({
				elements: [kanbanElement],
				appState: {
					selectedElementIds: { 'kanban-1': true },
				},
			});
		});

		rerender();
		expect(onOpenDetails).toHaveBeenCalled();
	});

	it('opens details when a newlex document becomes selected after mount', () => {
		const onOpenDetails = vi.fn();
		const newlexElement = {
			id: 'newlex-1',
			type: 'rectangle',
			customData: { type: 'newlex', title: 'Test Doc' },
		} as unknown as ExcalidrawElement;
		const { rerender } = renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		act(() => {
			useAppStore.setState({
				elements: [newlexElement],
				appState: {
					selectedElementIds: { 'newlex-1': true },
				},
			});
		});

		rerender();
		expect(onOpenDetails).toHaveBeenCalled();
	});

	it('does not open details when markdown note is selected', () => {
		const onOpenDetails = vi.fn();
		const markdownElement = {
			id: 'md-1',
			type: 'rectangle',
			customData: { type: 'markdown', content: 'Test' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [markdownElement],
			appState: {
				selectedElementIds: { 'md-1': true },
			},
		});

		renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(onOpenDetails).not.toHaveBeenCalled();
	});

	it('does not open details when web-embed is selected', () => {
		const onOpenDetails = vi.fn();
		const embedElement = {
			id: 'embed-1',
			type: 'rectangle',
			customData: { type: 'web-embed', url: 'https://example.com' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [embedElement],
			appState: {
				selectedElementIds: { 'embed-1': true },
			},
		});

		renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(onOpenDetails).not.toHaveBeenCalled();
	});

	it('does not open details when details panel is already open', () => {
		const onOpenDetails = vi.fn();
		const kanbanElement = {
			id: 'kanban-panel-open-test',
			type: 'rectangle',
			customData: { type: 'kanban', title: 'Test Board' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [kanbanElement],
			appState: {
				selectedElementIds: { 'kanban-panel-open-test': true },
			},
		});

		renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: true,
			}),
		);

		expect(onOpenDetails).not.toHaveBeenCalled();
	});

	it('returns correct selected element info for heavy resource', () => {
		const onOpenDetails = vi.fn();
		const kanbanElement = {
			id: 'kanban-2',
			type: 'rectangle',
			customData: { type: 'kanban', title: 'Test Board' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [kanbanElement],
			appState: {
				selectedElementIds: { 'kanban-2': true },
			},
		});

		const { result } = renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(result.current.selectedElement).not.toBeNull();
		expect(result.current.isHeavyResource).toBe(true);
	});

	it('returns correct selected element info for light resource', () => {
		const onOpenDetails = vi.fn();
		const markdownElement = {
			id: 'md-2',
			type: 'rectangle',
			customData: { type: 'markdown', content: 'Test' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [markdownElement],
			appState: {
				selectedElementIds: { 'md-2': true },
			},
		});

		const { result } = renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(result.current.selectedElement).not.toBeNull();
		expect(result.current.isHeavyResource).toBe(false);
	});

	it('returns null when multiple elements are selected', () => {
		const onOpenDetails = vi.fn();
		const kanbanElement1 = {
			id: 'kanban-3',
			type: 'rectangle',
			customData: { type: 'kanban', title: 'Board 1' },
		} as unknown as ExcalidrawElement;

		const kanbanElement2 = {
			id: 'kanban-4',
			type: 'rectangle',
			customData: { type: 'kanban', title: 'Board 2' },
		} as unknown as ExcalidrawElement;

		useAppStore.setState({
			elements: [kanbanElement1, kanbanElement2],
			appState: {
				selectedElementIds: { 'kanban-3': true, 'kanban-4': true },
			},
		});

		const { result } = renderHook(() =>
			useDetailsPanelOnSelection({
				onOpenDetails,
				isDetailsPanelOpen: false,
			}),
		);

		expect(result.current.selectedElement).toBeNull();
		expect(result.current.isHeavyResource).toBe(false);
	});
});
