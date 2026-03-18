import type { NewLexCommentThread, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LexicalElement } from './lexical-note-types';
import { useLexicalNoteState } from './useLexicalNoteState';

function createElement(overrides?: Partial<NewLexOverlayCustomData>): LexicalElement {
	return {
		id: 'lexical-element',
		width: 640,
		height: 420,
		backgroundColor: '#ffffff',
		strokeColor: '#111827',
		strokeWidth: 1,
		roundness: null,
		customData: {
			type: 'newlex',
			title: 'Rich Text',
			lexicalState:
				'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
			...overrides,
		},
	} as LexicalElement;
}

afterEach(() => {
	vi.useRealTimers();
});

describe('useLexicalNoteState', () => {
	it('syncs external title and comments into local state', () => {
		const onChange = vi.fn();
		const initialComments = [
			{
				id: 'thread-1',
				author: 'You',
				comment: 'Original',
				commentDeleted: false,
				anchorText: '',
				createdAt: 1,
				resolved: false,
				collapsed: false,
				replies: [],
			},
		];
		const { result, rerender } = renderHook(
			(props: { element: LexicalElement }) =>
				useLexicalNoteState({
					element: props.element,
					mode: 'live',
					isSelected: true,
					isActive: false,
					onChange,
				}),
			{
				initialProps: {
					element: createElement({
						title: 'Initial',
						comments: initialComments,
					}),
				},
			},
		);

		expect(result.current.title).toBe('Initial');
		expect(result.current.comments).toHaveLength(1);

		rerender({
			element: createElement({
				title: 'Updated',
				comments: [
					...initialComments,
					{
						id: 'thread-2',
						author: 'You',
						comment: 'Second',
						commentDeleted: false,
						anchorText: 'Selection',
						createdAt: 2,
						resolved: false,
						collapsed: false,
						replies: [],
					},
				],
			}),
		});

		expect(result.current.title).toBe('Updated');
		expect(result.current.comments).toHaveLength(2);
	});

	it('commits inline comments and reports editing lifecycle changes', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const onActivityChange = vi.fn();
		const { result } = renderHook(() =>
			useLexicalNoteState({
				element: createElement(),
				mode: 'live',
				isSelected: true,
				isActive: false,
				onChange,
				onActivityChange,
			}),
		);

		expect(onActivityChange).toHaveBeenLastCalledWith(false);

		act(() => {
			result.current.handleRequestComment('Selected text');
		});

		expect(onActivityChange).toHaveBeenLastCalledWith(true);

		act(() => {
			result.current.setCommentDraft('Discuss this paragraph');
		});

		act(() => {
			result.current.submitInlineComment();
		});

		expect(onChange).toHaveBeenCalledWith('lexical-element', {
			comments: [
				expect.objectContaining({
					comment: 'Discuss this paragraph',
					anchorText: 'Selected text',
				}),
			],
		});

		act(() => {
			result.current.handleTitleChange('Revised title');
		});

		act(() => {
			result.current.commitTitle();
		});

		expect(onChange).toHaveBeenCalledWith('lexical-element', {
			title: 'Revised title',
		});
	});

	it('reports inactive on unmount via useMountEffect cleanup', () => {
		const onChange = vi.fn();
		const onActivityChange = vi.fn();
		const { result, unmount } = renderHook(() =>
			useLexicalNoteState({
				element: createElement(),
				mode: 'live',
				isSelected: true,
				isActive: false,
				onChange,
				onActivityChange,
			}),
		);

		// Activate editing
		act(() => {
			result.current.setIsEditing(true);
		});

		expect(onActivityChange).toHaveBeenLastCalledWith(true);

		// Unmount should report inactive via cleanup
		unmount();

		expect(onActivityChange).toHaveBeenLastCalledWith(false);
	});

	it('handles deselection via useEffect with ref pattern', () => {
		const onChange = vi.fn();
		const { result, rerender } = renderHook(
			(props: { isSelected: boolean }) =>
				useLexicalNoteState({
					element: createElement(),
					mode: 'live',
					isSelected: props.isSelected,
					isActive: false,
					onChange,
				}),
			{
				initialProps: { isSelected: true },
			},
		);

		// Activate editing and comment composer
		act(() => {
			result.current.setIsEditing(true);
			result.current.setShowCommentComposer(true);
		});

		expect(result.current.isEditing).toBe(true);
		expect(result.current.showCommentComposer).toBe(true);

		// Deselect
		rerender({ isSelected: false });

		expect(result.current.isEditing).toBe(false);
		expect(result.current.showCommentComposer).toBe(false);
	});

	it('validates selectedCommentId and returns null for invalid IDs via derived state', () => {
		const onChange = vi.fn();
		const initialComments: NewLexCommentThread[] = [
			{
				id: 'thread-1',
				author: 'You',
				comment: 'First comment',
				commentDeleted: false,
				anchorText: '',
				createdAt: 1,
				resolved: false,
				collapsed: false,
				replies: [],
			},
		];
		const { result, rerender } = renderHook(
			(props: { element: LexicalElement }) =>
				useLexicalNoteState({
					element: props.element,
					mode: 'live',
					isSelected: true,
					isActive: false,
					onChange,
				}),
			{
				initialProps: {
					element: createElement({ comments: initialComments }),
				},
			},
		);

		// Select valid comment
		act(() => {
			result.current.setSelectedCommentId('thread-1');
		});

		expect(result.current.selectedCommentId).toBe('thread-1');

		// Remove the comment externally
		rerender({
			element: createElement({ comments: [] }),
		});

		// selectedCommentId should be null (filtered out by derived state)
		expect(result.current.selectedCommentId).toBe(null);
	});

	it('debounces title changes via useEffect', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useLexicalNoteState({
				element: createElement({ title: 'Initial' }),
				mode: 'live',
				isSelected: true,
				isActive: false,
				onChange,
			}),
		);

		// Change title multiple times rapidly
		act(() => {
			result.current.handleTitleChange('Title 1');
		});
		act(() => {
			result.current.handleTitleChange('Title 2');
		});
		act(() => {
			result.current.handleTitleChange('Title 3');
		});

		// Should not have committed yet
		expect(onChange).not.toHaveBeenCalledWith('lexical-element', { title: 'Title 3' });

		// Advance timers
		act(() => {
			vi.advanceTimersByTime(200);
		});

		// Now should have committed the final value
		expect(onChange).toHaveBeenCalledWith('lexical-element', { title: 'Title 3' });
	});

	it('keeps callback ref in sync via useEffect', () => {
		const onChange = vi.fn();
		const onActivityChange1 = vi.fn();
		const onActivityChange2 = vi.fn();

		const { result, rerender } = renderHook(
			(props: { onActivityChange: typeof onActivityChange1 }) =>
				useLexicalNoteState({
					element: createElement(),
					mode: 'live',
					isSelected: true,
					isActive: false,
					onChange,
					onActivityChange: props.onActivityChange,
				}),
			{
				initialProps: { onActivityChange: onActivityChange1 },
			},
		);

		// Trigger activity to call first callback
		act(() => {
			result.current.setIsEditing(true);
		});

		expect(onActivityChange1).toHaveBeenCalledWith(true);

		// Change the callback
		rerender({ onActivityChange: onActivityChange2 });

		// Trigger another activity change
		act(() => {
			result.current.setIsEditing(false);
		});

		// New callback should be called, not the old one
		expect(onActivityChange2).toHaveBeenCalledWith(false);
	});
});
