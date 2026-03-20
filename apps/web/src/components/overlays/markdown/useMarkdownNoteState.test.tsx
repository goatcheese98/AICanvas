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
	vi.restoreAllMocks();
});

describe('useMarkdownNoteState', () => {
	it('initializes local state from the current external note snapshot', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement({
					content: 'Updated content',
					title: 'UP',
				}),
				mode: 'live',
				isSelected: false,
				isActive: false,
				onChange,
			}),
		);

		expect(result.current.content).toBe('Updated content');
		expect(result.current.title).toBe('UP');
	});

	it('debounces content commits through the extracted state hook', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				mode: 'live',
				isSelected: true,
				isActive: true,
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

	it('reports activity lifecycle changes when selection state changes', () => {
		const onChange = vi.fn();
		const onActivityChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useMarkdownNoteState({
					element: createElement(),
					mode: 'live',
					isSelected: props.isSelected,
					isActive: props.isSelected,
					onChange,
					onActivityChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		expect(onActivityChange).toHaveBeenLastCalledWith(true);

		rerender({ isSelected: false });

		expect(onActivityChange).toHaveBeenLastCalledWith(false);
	});

	// --- Edge case tests ---

	it('does not fire onChange when content is identical to external state', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
				onChange,
			}),
		);

		act(() => result.current.handleTitleChange('  AB  '));
		act(() => result.current.handleTitleBlur());

		expect(result.current.title).toBe('AB');
	});

	it('subsequent autosaves keep the latest edited title', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement({ title: 'Original' }),
				mode: 'live',
				isSelected: true,
				isActive: true,
				onChange,
			}),
		);

		act(() => result.current.handleTitleChange('Renamed'));
		act(() => result.current.setContent('Body changed'));
		act(() => vi.advanceTimersByTime(200));

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Body changed',
			expect.any(Object),
			'Renamed',
			expect.any(Object),
			'raw',
		);
	});

	it('ignores external update when serialized state has not changed', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: MarkdownElement }) =>
				useMarkdownNoteState({
					element: props.element,
					mode: 'live',
					isSelected: false,
					isActive: false,
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

	it('preserves local draft state for direct hook callers across prop rerenders', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { element: MarkdownElement }) =>
				useMarkdownNoteState({
					element: props.element,
					mode: 'live',
					isSelected: true,
					isActive: true,
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

		// Direct hook callers keep their local draft until they remount.
		expect(result.current.content).toBe('Local edit');
	});

	it('deselecting resets to preview mode and closes panels', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useMarkdownNoteState({
					element: createElement(),
					mode: 'live',
					isSelected: props.isSelected,
					isActive: props.isSelected,
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

	it('does not re-report the same activity state', () => {
		const onChange = vi.fn();
		const onActivityChange = vi.fn();
		const { rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useMarkdownNoteState({
					element: createElement(),
					mode: 'live',
					isSelected: props.isSelected,
					isActive: props.isSelected,
					onChange,
					onActivityChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		const callCount = onActivityChange.mock.calls.length;

		// Re-render with same state
		rerender({ isSelected: true });
		expect(onActivityChange.mock.calls.length).toBe(callCount);
	});

	it('handleCommit immediately persists current state', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
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
				mode: 'live',
				isSelected: true,
				isActive: true,
				onChange,
			}),
		);

		act(() => result.current.handlePreviewCheckboxToggle(0));

		// Should be called immediately, no debounce
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(result.current.content).toContain('[x]');
	});

	it('handleEditorCheckboxToggle persists through the debounced autosave path', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement({ content: '- [ ] unchecked\n- [x] checked' }),
				mode: 'live',
				isSelected: true,
				isActive: true,
				onChange,
			}),
		);

		act(() => result.current.handleEditorCheckboxToggle(0));

		expect(result.current.content).toContain('- [x] unchecked');
		expect(onChange).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(200));

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenLastCalledWith(
			'markdown-element',
			'- [x] unchecked\n- [x] checked',
			expect.any(Object),
			'MD',
			expect.any(Object),
			'raw',
		);
	});

	it('insertImageFiles persists inserted content and image metadata through autosave', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();

		class MockFileReader {
			result = 'data:image/png;base64,AAAA';
			error = null;
			onload: ((this: FileReader, event: ProgressEvent<FileReader>) => void) | null = null;
			onerror: ((this: FileReader, event: ProgressEvent<FileReader>) => void) | null = null;

			readAsDataURL(_file: Blob) {
				this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
			}
		}

		vi.stubGlobal('FileReader', MockFileReader);
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'11111111-1111-1111-1111-111111111111',
		);

		const { result } = renderHook(() =>
			useMarkdownNoteState({
				element: createElement(),
				mode: 'live',
				isSelected: true,
				isActive: true,
				onChange,
			}),
		);

		const file = new File(['image-bytes'], 'diagram.png', { type: 'image/png' });
		const fileList = {
			0: file,
			length: 1,
			item: (index: number) => (index === 0 ? file : null),
		} as unknown as FileList;

		await act(async () => {
			await result.current.insertImageFiles(fileList);
		});

		expect(result.current.content).toContain(
			'![diagram.png](image://11111111-1111-1111-1111-111111111111)',
		);
		expect(result.current.images).toEqual({
			'11111111-1111-1111-1111-111111111111': 'data:image/png;base64,AAAA',
		});
		expect(onChange).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(200));

		expect(onChange).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenLastCalledWith(
				'markdown-element',
				'Hello\n\n![diagram.png](image://11111111-1111-1111-1111-111111111111)',
				{ '11111111-1111-1111-1111-111111111111': 'data:image/png;base64,AAAA' },
				'MD',
				expect.any(Object),
				'raw',
		);
	});
});
