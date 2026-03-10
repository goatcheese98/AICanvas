import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBufferedDocument } from './useBufferedDocument';

describe('useBufferedDocument', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('debounces local edits into a single commit with the latest value', () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() =>
			useBufferedDocument({
				remoteValue: 'start',
				isEditing: true,
				debounceMs: 300,
				onCommit,
			}),
		);

		act(() => {
			result.current.scheduleLocalChange('start a');
			result.current.scheduleLocalChange('start ab');
			vi.advanceTimersByTime(299);
		});

		expect(onCommit).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(1);
		});

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith('start ab', 'debounce');
	});

	it('flushes immediately when editing stops', () => {
		const onCommit = vi.fn();
		const { result, rerender } = renderHook(
			({ remoteValue, isEditing }: { remoteValue: string; isEditing: boolean }) =>
				useBufferedDocument({
					remoteValue,
					isEditing,
					debounceMs: 300,
					onCommit,
				}),
			{
				initialProps: {
					remoteValue: 'draft',
					isEditing: true,
				},
			},
		);

		act(() => {
			result.current.scheduleLocalChange('draft changed');
		});

		rerender({
			remoteValue: 'draft',
			isEditing: false,
		});

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith('draft changed', 'editing-exit');
	});

	it('accepts external remote updates only when idle', () => {
		const onCommit = vi.fn();
		const { result, rerender } = renderHook(
			({ remoteValue, isEditing }: { remoteValue: string; isEditing: boolean }) =>
				useBufferedDocument({
					remoteValue,
					isEditing,
					debounceMs: 300,
					onCommit,
				}),
			{
				initialProps: {
					remoteValue: 'remote one',
					isEditing: false,
				},
			},
		);

		const initialKey = result.current.editorInstanceKey;

		rerender({
			remoteValue: 'remote two',
			isEditing: false,
		});

		expect(result.current.editorInstanceKey).toBe(initialKey + 1);
		expect(result.current.editorInitialValue).toBe('remote two');
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('does not overwrite local state with stale remote data while waiting for commit ack', () => {
		const onCommit = vi.fn();
		const { result, rerender } = renderHook(
			({ remoteValue, isEditing }: { remoteValue: string; isEditing: boolean }) =>
				useBufferedDocument({
					remoteValue,
					isEditing,
					debounceMs: 300,
					onCommit,
				}),
			{
				initialProps: {
					remoteValue: 'remote',
					isEditing: true,
				},
			},
		);

		act(() => {
			result.current.scheduleLocalChange('local draft');
			vi.advanceTimersByTime(300);
		});

		expect(onCommit).toHaveBeenCalledWith('local draft', 'debounce');

		const currentKey = result.current.editorInstanceKey;

		rerender({
			remoteValue: 'remote',
			isEditing: false,
		});

		expect(result.current.editorInstanceKey).toBe(currentKey);

		rerender({
			remoteValue: 'local draft',
			isEditing: false,
		});

		expect(result.current.editorInstanceKey).toBe(currentKey);
	});
});
