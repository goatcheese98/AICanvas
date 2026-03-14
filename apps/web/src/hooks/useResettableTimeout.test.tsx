import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResettableTimeout } from './useResettableTimeout';

describe('useResettableTimeout', () => {
	it('replaces the previous timeout when rescheduled', () => {
		vi.useFakeTimers();
		const callback = vi.fn();
		const { result } = renderHook(() => useResettableTimeout());

		act(() => {
			result.current.schedule(callback, 1000);
		});

		act(() => {
			vi.advanceTimersByTime(600);
			result.current.schedule(callback, 1000);
		});

		act(() => {
			vi.advanceTimersByTime(999);
		});

		expect(callback).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(1);
		});

		expect(callback).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('clears pending timeouts on unmount', () => {
		vi.useFakeTimers();
		const callback = vi.fn();
		const { result, unmount } = renderHook(() => useResettableTimeout());

		act(() => {
			result.current.schedule(callback, 1000);
		});

		unmount();

		act(() => {
			vi.runAllTimers();
		});

		expect(callback).not.toHaveBeenCalled();
		vi.useRealTimers();
	});
});
