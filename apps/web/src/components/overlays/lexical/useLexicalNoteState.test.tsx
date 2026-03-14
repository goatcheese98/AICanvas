import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
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
					isSelected: true,
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
		const onEditingChange = vi.fn();
		const { result } = renderHook(() =>
			useLexicalNoteState({
				element: createElement(),
				isSelected: true,
				onChange,
				onEditingChange,
			}),
		);

		expect(onEditingChange).toHaveBeenLastCalledWith(false);

		act(() => {
			result.current.handleRequestComment('Selected text');
		});

		expect(onEditingChange).toHaveBeenLastCalledWith(true);

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
});
