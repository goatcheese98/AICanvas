import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOutsideClick } from './useOutsideClick';

describe('useOutsideClick', () => {
	const mockAddEventListener = vi.spyOn(window, 'addEventListener');
	const mockRemoveEventListener = vi.spyOn(window, 'removeEventListener');

	beforeEach(() => {
		mockAddEventListener.mockClear();
		mockRemoveEventListener.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should add event listener when isActive is true', () => {
		const ref = { current: document.createElement('div') };
		const onOutsideClick = vi.fn();

		renderHook(() => useOutsideClick(ref, true, onOutsideClick));

		expect(mockAddEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
	});

	it('should not add event listener when isActive is false', () => {
		const ref = { current: document.createElement('div') };
		const onOutsideClick = vi.fn();

		renderHook(() => useOutsideClick(ref, false, onOutsideClick));

		expect(mockAddEventListener).not.toHaveBeenCalled();
	});

	it('should remove event listener on unmount when active', () => {
		const ref = { current: document.createElement('div') };
		const onOutsideClick = vi.fn();

		const { unmount } = renderHook(() => useOutsideClick(ref, true, onOutsideClick));
		unmount();

		expect(mockRemoveEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
	});
});
