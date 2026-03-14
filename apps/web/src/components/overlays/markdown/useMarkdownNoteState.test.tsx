import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarkdownElement } from './markdown-note-types';
import { useMarkdownNoteState } from './useMarkdownNoteState';

function createElement(overrides?: Partial<MarkdownElement['customData']>): MarkdownElement {
	return {
		id: 'markdown-element',
		width: 420,
		height: 480,
		backgroundColor: '#ffffff',
		strokeColor: '#111827',
		strokeWidth: 1,
		roundness: null,
		customData: {
			type: 'markdown',
			title: 'MD',
			content: 'Hello',
			editorMode: 'raw',
			...overrides,
		},
	} as MarkdownElement;
}

afterEach(() => {
	vi.useRealTimers();
});

describe('useMarkdownNoteState', () => {
	it('syncs external note updates into local state', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: MarkdownElement }) =>
				useMarkdownNoteState({
					element: props.element,
					isSelected: false,
					onChange,
				}),
			{
				initialProps: {
					element: createElement(),
				},
			},
		);

		expect(result.current.content).toBe('Hello');

		rerender({
			element: createElement({
				content: 'Updated content',
				title: 'UP',
			}),
		});

		expect(result.current.content).toBe('Updated content');
		expect(result.current.title).toBe('UP');
	});

	it('debounces content commits through the extracted state hook', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.setContent('Hello world');
		});

		expect(onChange).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Hello world',
			expect.any(Object),
			'MD',
			expect.any(Object),
			'raw',
		);
	});

	it('reports editing lifecycle changes when selection state changes', () => {
		const onChange = vi.fn();
		const onEditingChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useMarkdownNoteState({
					element: createElement(),
					isSelected: props.isSelected,
					onChange,
					onEditingChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		expect(onEditingChange).toHaveBeenLastCalledWith(true);

		rerender({ isSelected: false });

		expect(onEditingChange).toHaveBeenLastCalledWith(false);
	});

	// --- Edge case tests ---

	it('does not fire onChange when content is identical to external state', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		// Set content to same value as external state
		act(() => {
			result.current.setContent('Hello');
		});

		act(() => {
			vi.advanceTimersByTime(300);
		});

		expect(onChange).not.toHaveBeenCalled();
	});

	it('debounce resets when content changes rapidly', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		// Type three characters in quick succession
		act(() => result.current.setContent('Hello w'));
		act(() => vi.advanceTimersByTime(100));
		act(() => result.current.setContent('Hello wo'));
		act(() => vi.advanceTimersByTime(100));
		act(() => result.current.setContent('Hello wor'));

		// Not yet committed — each change resets the timer
		expect(onChange).not.toHaveBeenCalled();

		// Wait for debounce to settle
		act(() => vi.advanceTimersByTime(200));

		// Should commit only the final state
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Hello wor',
			expect.any(Object),
			'MD',
			expect.any(Object),
			'raw',
		);
	});

	it('does not debounce-commit while in preview mode with no utility panel', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		// Enter preview mode
		act(() => result.current.setIsPreview(true));

		// Change content while in preview
		act(() => result.current.setContent('Changed in preview'));

		act(() => vi.advanceTimersByTime(300));

		// The debounce effect checks `isPreview && activeUtilityPanel === 'none'` and returns early
		expect(onChange).not.toHaveBeenCalled();
	});

	it('handleTitleChange truncates at MAX_MARKDOWN_TITLE_LENGTH and shows notice', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.handleTitleChange('ABCDEFGHIJ'); // 10 chars, max is 8
		});

		expect(result.current.title).toBe('ABCDEFGH');
		expect(result.current.titleNotice).toBe(true);
	});

	it('handleTitleBlur reverts to normalized title when blank', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement({ title: 'MyNote' }),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.handleTitleChange(''));
		act(() => result.current.handleTitleBlur());

		// Should revert to the normalized element title
		expect(result.current.title.length).toBeGreaterThan(0);
	});

	it('handleTitleBlur trims whitespace', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement({ title: 'MD' }),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.handleTitleChange('  AB  '));
		act(() => result.current.handleTitleBlur());

		expect(result.current.title).toBe('AB');
	});

	it('ignores external update when serialized state has not changed', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: MarkdownElement }) =>
				useMarkdownNoteState({
					element: props.element,
					isSelected: false,
					onChange,
				}),
			{
				initialProps: { element: createElement() },
			},
		);

		const contentBefore = result.current.content;

		// Rerender with structurally identical data
		rerender({ element: createElement() });

		expect(result.current.content).toBe(contentBefore);
	});

	it('external update overwrites local draft when signature differs', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: MarkdownElement }) =>
				useMarkdownNoteState({
					element: props.element,
					isSelected: true,
					onChange,
				}),
			{
				initialProps: { element: createElement() },
			},
		);

		// Make a local edit
		act(() => result.current.setContent('Local edit'));

		// External update arrives before debounce fires
		rerender({
			element: createElement({ content: 'Remote edit', title: 'MD' }),
		});

		// External update should overwrite local draft
		expect(result.current.content).toBe('Remote edit');
	});

	it('deselecting resets to preview mode and closes panels', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useMarkdownNoteState({
					element: createElement(),
					isSelected: props.isSelected,
					onChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		act(() => {
			result.current.setIsPreview(false);
			result.current.setActiveUtilityPanel('style');
			result.current.setIsCompactControlsVisible(true);
		});

		rerender({ isSelected: false });

		expect(result.current.isPreview).toBe(true);
		expect(result.current.activeUtilityPanel).toBe('none');
		expect(result.current.isCompactControlsVisible).toBe(false);
	});

	it('does not re-report the same editing state', () => {
		const onChange = vi.fn();
		const onEditingChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useMarkdownNoteState({
					element: createElement(),
					isSelected: props.isSelected,
					onChange,
					onEditingChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		const callCount = onEditingChange.mock.calls.length;

		// Re-render with same state
		rerender({ isSelected: true });
		expect(onEditingChange.mock.calls.length).toBe(callCount);
	});

	it('handleCommit immediately persists current state', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.setContent('Immediate save'));
		act(() => result.current.handleCommit());

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Immediate save',
			expect.any(Object),
			'MD',
			expect.any(Object),
			'raw',
		);
	});

	it('hasLocalEdits is true when local state differs from external prop', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		expect(result.current.hasLocalEdits).toBe(false);

		act(() => result.current.setContent('Changed'));
		expect(result.current.hasLocalEdits).toBe(true);

		// handleCommit persists to parent but hasLocalEdits still compares
		// against the external prop (externalSignatureRef), which hasn't changed.
		// This is correct — local edits are relative to what the parent provided.
		act(() => result.current.handleCommit());
		expect(result.current.hasLocalEdits).toBe(true);
	});

	it('settings changes are included in debounced commits', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		act(() => {
			result.current.setSettings((prev) => ({ ...prev, font: 'Georgia, serif' }));
		});

		act(() => vi.advanceTimersByTime(200));

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Hello',
			expect.any(Object),
			'MD',
			expect.objectContaining({ font: 'Georgia, serif' }),
			'raw',
		);
	});

	it('editorMode changes are included in debounced commits', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.setEditorMode('hybrid'));
		act(() => vi.advanceTimersByTime(200));

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Hello',
			expect.any(Object),
			'MD',
			expect.any(Object),
			'hybrid',
		);
	});

	it('handlePreviewCheckboxToggle commits immediately without debounce', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement({ content: '- [ ] unchecked\n- [x] checked' }),
				isSelected: true,
				onChange,
			}),
		);

		act(() => result.current.handlePreviewCheckboxToggle(0));

		// Should be called immediately, no debounce
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(result.current.content).toContain('[x]');
	});
});
