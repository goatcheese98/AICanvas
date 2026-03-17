import { useAppStore } from '@/stores/store';
import type { NewLexCommentThread, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LexicalNoteContainer } from './LexicalNoteContainer';
import type { LexicalNoteProps } from './lexical-note-types';

function createCommentThread(overrides?: Partial<NewLexCommentThread>): NewLexCommentThread {
	return {
		id: 'thread-1',
		author: 'You',
		comment: 'Discuss the intro',
		commentDeleted: false,
		anchorText: 'Intro',
		createdAt: 1,
		resolved: false,
		collapsed: false,
		replies: [],
		...overrides,
	};
}

function createElement(customData?: Partial<NewLexOverlayCustomData>): LexicalNoteProps['element'] {
	return {
		id: 'lexical-element',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 900,
		height: 520,
		angle: 0,
		backgroundColor: '#ffffff',
		strokeColor: '#111827',
		strokeWidth: 1,
		strokeStyle: 'solid',
		fillStyle: 'solid',
		roughness: 0,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		seed: 1,
		index: 'a0' as never,
		customData: {
			type: 'newlex',
			title: 'Rich Text',
			lexicalState:
				'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
			...customData,
		},
	} as LexicalNoteProps['element'];
}

beforeEach(() => {
	useAppStore.setState({
		excalidrawApi: null,
		elements: [],
		appState: {
			scrollX: 0,
			scrollY: 0,
			selectedElementIds: {},
		},
		files: {},
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('LexicalNoteContainer', () => {
	it('hides the comments toggle when there are no comment threads yet', () => {
		render(<LexicalNoteContainer element={createElement()} isSelected onChange={vi.fn()} />);

		expect(screen.queryByRole('button', { name: '0 comments' })).toBeNull();
	});

	it('commits title changes and opens the comments panel through the container boundary', () => {
		const onChange = vi.fn();
		const onEditingChange = vi.fn();

		render(
			<LexicalNoteContainer
				element={createElement({
					comments: [createCommentThread()],
				})}
				isSelected
				onChange={onChange}
				onEditingChange={onEditingChange}
			/>,
		);

		expect(onEditingChange).toHaveBeenLastCalledWith(false);

		const titleInput = screen.getByLabelText('Rich text title');
		fireEvent.change(titleInput, { target: { value: 'Revised title' } });
		fireEvent.blur(titleInput);

		expect(onChange).toHaveBeenCalledWith('lexical-element', {
			title: 'Revised title',
		});

		fireEvent.click(screen.getByRole('button', { name: '1 comments' }));

		expect(screen.getByText('Discuss the intro')).not.toBeNull();
		expect(onEditingChange).toHaveBeenLastCalledWith(true);
	});

	it('prevents preview text selection when double-clicking into edit mode', () => {
		const onEditingChange = vi.fn();
		const removeAllRanges = vi.fn();
		vi.spyOn(window, 'getSelection').mockReturnValue({
			removeAllRanges,
			setBaseAndExtent: vi.fn(),
		} as unknown as Selection);

		render(
			<LexicalNoteContainer
				element={createElement()}
				isSelected
				onChange={vi.fn()}
				onEditingChange={onEditingChange}
			/>,
		);

		const previewBody = screen.getByTestId('lexical-note-body');
		const event = createEvent.dblClick(previewBody);
		fireEvent(previewBody, event);

		expect(event.defaultPrevented).toBe(true);
		expect(removeAllRanges).toHaveBeenCalledTimes(1);
		expect(onEditingChange).toHaveBeenLastCalledWith(true);
	});

	it('expands the editor through the Excalidraw API boundary', () => {
		const updateScene = vi.fn();
		const excalidrawApi = {
			getSceneElements: () => [createElement()],
			updateScene,
		};

		useAppStore.setState({ excalidrawApi: excalidrawApi as never });

		render(<LexicalNoteContainer element={createElement()} isSelected onChange={vi.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

		expect(updateScene).toHaveBeenCalledWith({
			elements: [
				expect.objectContaining({
					id: 'lexical-element',
					width: 1120,
				}),
			],
		});
	});
});
