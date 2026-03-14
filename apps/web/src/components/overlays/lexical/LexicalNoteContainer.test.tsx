import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { useAppStore } from '@/stores/store';
import { LexicalNoteContainer } from './LexicalNoteContainer';
import type { LexicalNoteProps } from './lexical-note-types';

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
});

describe('LexicalNoteContainer', () => {
	it('commits title changes and opens the comments panel through the container boundary', () => {
		const onChange = vi.fn();
		const onEditingChange = vi.fn();

		render(
			<LexicalNoteContainer
				element={createElement()}
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

		fireEvent.click(screen.getByRole('button', { name: '0 comments' }));

		expect(screen.getByText('No comments yet.')).not.toBeNull();
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
