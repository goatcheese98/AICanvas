import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMarkdownActivity } from './useMarkdownActivity';

describe('useMarkdownActivity', () => {
	it('reports true when isEditing becomes true on mount', () => {
		const onActivityChange = vi.fn();
		renderHook(() =>
			useMarkdownActivity({
				isEditing: true,
				onActivityChange,
			}),
		);

		expect(onActivityChange).toHaveBeenCalledWith(true);
	});

	it('does not report when isEditing is false on mount', () => {
		const onActivityChange = vi.fn();
		renderHook(() =>
			useMarkdownActivity({
				isEditing: false,
				onActivityChange,
			}),
		);

		expect(onActivityChange).not.toHaveBeenCalled();
	});

	it('reports activity changes when isEditing toggles', () => {
		const onActivityChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isEditing: boolean }) =>
				useMarkdownActivity({
					isEditing: props.isEditing,
					onActivityChange,
				}),
			{
				initialProps: { isEditing: false },
			},
		);

		// First, activate
		act(() => rerender({ isEditing: true }));
		expect(onActivityChange).toHaveBeenLastCalledWith(true);

		// Then deactivate
		act(() => rerender({ isEditing: false }));
		expect(onActivityChange).toHaveBeenLastCalledWith(false);
	});

	it('does not re-report the same activity state', () => {
		const onActivityChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isEditing: boolean }) =>
				useMarkdownActivity({
					isEditing: props.isEditing,
					onActivityChange,
				}),
			{
				initialProps: { isEditing: true },
			},
		);

		const callCount = onActivityChange.mock.calls.length;

		// Re-render with same state
		act(() => rerender({ isEditing: true }));
		expect(onActivityChange.mock.calls.length).toBe(callCount);
	});

	it('reports false on unmount when was editing', () => {
		const onActivityChange = vi.fn();
		const { unmount } = renderHook(() =>
			useMarkdownActivity({
				isEditing: true,
				onActivityChange,
			}),
		);

		expect(onActivityChange).toHaveBeenCalledWith(true);

		act(() => unmount());

		expect(onActivityChange).toHaveBeenLastCalledWith(false);
	});

	it('handles onActivityChange callback updates', () => {
		const onActivityChange1 = vi.fn();
		const onActivityChange2 = vi.fn();

		const { rerender } = renderHook(
			(props: { onActivityChange: typeof onActivityChange1; isEditing: boolean }) =>
				useMarkdownActivity({
					isEditing: props.isEditing,
					onActivityChange: props.onActivityChange,
				}),
			{
				initialProps: { onActivityChange: onActivityChange1, isEditing: true },
			},
		);

		expect(onActivityChange1).toHaveBeenCalledWith(true);

		// Update the callback and trigger a state change
		act(() => rerender({ onActivityChange: onActivityChange2, isEditing: false }));

		expect(onActivityChange2).toHaveBeenCalledWith(false);
	});

	it('works without onActivityChange callback', () => {
		// Should not throw
		const { rerender, unmount } = renderHook(
			(props: { isEditing: boolean }) =>
				useMarkdownActivity({
					isEditing: props.isEditing,
				}),
			{
				initialProps: { isEditing: true },
			},
		);

		act(() => rerender({ isEditing: false }));
		act(() => unmount());
	});
});
