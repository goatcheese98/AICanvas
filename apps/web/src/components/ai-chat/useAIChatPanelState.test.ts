import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAIChatPanelState, useSuggestionHandler } from './useAIChatPanelState';

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

	it('computes disabled state correctly', () => {
		const { result } = renderHook(() =>
			useAIChatPanelState({
				elements: [],
				selectedElementIds: {},
			}),
		);

		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: false })).toBe(true);

		act(() => {
			result.current.setInput('   ');
		});
		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: false })).toBe(true);

		act(() => {
			result.current.setInput('Hello');
		});
		expect(result.current.isDisabled({ isChatLoading: false, isThreadsLoading: false })).toBe(
			false,
		);

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
		expect(result.current.selectionIndicator?.detail).toBe(
			'The assistant will use this automatically when it helps.',
		);
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
