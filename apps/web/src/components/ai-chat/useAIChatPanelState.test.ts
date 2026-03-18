import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	useAIChatPanelState,
	useSelectionConfirmation,
	useSuggestionHandler,
} from './useAIChatPanelState';

describe('useAIChatPanelState', () => {
	it('initializes with default values', () => {
		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: [],
				selectedElementIds: {},
			}),
		);

		expect(result.current.input).toBe('');
		expect(result.current.isHistoryCollapsed).toBe(false);
		expect(result.current.outputStyle).toBe('auto');
		expect(result.current.selectionIndicator).toBeNull();
	});

	it('updates input state', () => {
		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: [],
				selectedElementIds: {},
			}),
		);

		act(() => {
			result.current.setInput('Hello world');
		});

		expect(result.current.input).toBe('Hello world');
	});

	it('toggles history collapsed state', () => {
		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: [],
				selectedElementIds: {},
			}),
		);

		act(() => {
			result.current.setIsHistoryCollapsed((prev) => !prev);
		});

		expect(result.current.isHistoryCollapsed).toBe(true);

		act(() => {
			result.current.setIsHistoryCollapsed((prev) => !prev);
		});

		expect(result.current.isHistoryCollapsed).toBe(false);
	});

	it('updates output style', () => {
		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: [],
				selectedElementIds: {},
			}),
		);

		act(() => {
			result.current.setOutputStyle('svg');
		});

		expect(result.current.outputStyle).toBe('svg');
	});

	it('computes disabled state correctly', () => {
		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: [],
				selectedElementIds: {},
			}),
		);

		// Empty input should be disabled
		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: false })).toBe(true);

		// Whitespace-only input should be disabled
		act(() => {
			result.current.setInput('   ');
		});
		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: false })).toBe(true);

		// Non-empty input should be enabled
		act(() => {
			result.current.setInput('Hello');
		});
		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: false })).toBe(false);

		// Loading states should disable
		expect(result.current.isDisabled({ isChatLoading: true, isThreadsLoading: false })).toBe(true);
		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: true })).toBe(true);
	});

	it('computes selection indicator for selected elements', () => {
		const elements = [
			{ id: 'el1', type: 'rectangle', width: 100, height: 100 },
			{ id: 'el2', type: 'rectangle', width: 50, height: 50 },
		] as const;

		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: elements as unknown as Parameters<typeof useAIChatPanelState>[0]['elements'],
				selectedElementIds: { el1: true },
			}),
		);

		expect(result.current.selectionIndicator).not.toBeNull();
		expect(result.current.selectionIndicator?.count).toBe(1);
	});
});

describe('useSelectionConfirmation', () => {
	it('initializes with null pending confirmation', () => {
		const { result } = renderHook(() =>
			useSelectionConfirmation({
				selectionIndicator: { count: 1, label: '1 element', detail: 'Details' },
			}),
		);

		expect(result.current.pendingSelectionConfirmation).toBeNull();
	});

	it('requests selection confirmation when selection exists', () => {
		const { result } = renderHook(() =>
			useSelectionConfirmation({
				selectionIndicator: { count: 1, label: '1 element', detail: 'Details' },
			}),
		);

		let requestResult: boolean | undefined;
		act(() => {
			requestResult = result.current.requestSelectionConfirmation('Test prompt');
		});

		expect(requestResult).toBe(true);
		expect(result.current.pendingSelectionConfirmation).toEqual({
			prompt: 'Test prompt',
			createdAt: expect.any(String),
		});
	});

	it('fails to request confirmation when no selection exists', () => {
		const { result } = renderHook(() =>
			useSelectionConfirmation({
				selectionIndicator: null,
			}),
		);

		let requestResult: boolean | undefined;
		act(() => {
			requestResult = result.current.requestSelectionConfirmation('Test prompt');
		});

		expect(requestResult).toBe(false);
		expect(result.current.pendingSelectionConfirmation).toBeNull();
	});

	it('clears confirmation when selection is lost', () => {
		type SelectionIndicator = { count: number; label: string; detail: string } | null;
		const initialProps: { selectionIndicator: SelectionIndicator } = {
			selectionIndicator: { count: 1, label: '1 element', detail: 'Details' },
		};
		const { result, rerender } = renderHook(
			(props: { selectionIndicator: SelectionIndicator }) =>
				useSelectionConfirmation({ selectionIndicator: props.selectionIndicator }),
			{ initialProps },
		);

		// Set up confirmation
		act(() => {
			result.current.requestSelectionConfirmation('Test prompt');
		});

		expect(result.current.pendingSelectionConfirmation).not.toBeNull();

		// Clear when selection lost
		act(() => {
			result.current.clearSelectionConfirmationIfNeeded();
		});

		// Should still have confirmation since selection still exists
		expect(result.current.pendingSelectionConfirmation).not.toBeNull();

		// Simulate selection lost
		rerender({ selectionIndicator: null });

		act(() => {
			result.current.clearSelectionConfirmationIfNeeded();
		});

		expect(result.current.pendingSelectionConfirmation).toBeNull();
	});
});

describe('useSuggestionHandler', () => {
	it('sets input value when suggestion is clicked', () => {
		const setInput = vi.fn();
		const { result } = renderHook(() => useSuggestionHandler({ setInput }));

		act(() => {
			result.current('Diagram the auth flow');
		});

		expect(setInput).toHaveBeenCalledWith('Diagram the auth flow');
	});
});
