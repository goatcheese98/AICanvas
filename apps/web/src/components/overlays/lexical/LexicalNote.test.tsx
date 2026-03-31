import { useAppStore } from '@/stores/store';
import type { NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LexicalNote } from './LexicalNote';

function createElement(customData?: Partial<NewLexOverlayCustomData>) {
	return {
		id: 'lexical-element',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 500,
		height: 400,
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
			title: 'Test Note',
			lexicalState:
				'{"root":{"children":[{"children":[{"text":"This is a test note content."}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
			...customData,
		},
	} as Parameters<typeof LexicalNote>[0]['element'];
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

describe('LexicalNote', () => {
	it('renders preview card when mode is preview', () => {
		render(
			<LexicalNote
				element={createElement()}
				mode="preview"
				isSelected={false}
				isActive={false}
				onChange={vi.fn()}
			/>,
		);

		// Preview card shows title and content snippet
		expect(screen.getAllByText('Test Note')[0]).not.toBeNull();
		expect(screen.getAllByText('This is a test note content.')[0]).not.toBeNull();
		expect(screen.getAllByText('Double-click to open')[0]).not.toBeNull();
	});

	it('renders full editor when mode is live', () => {
		render(
			<LexicalNote
				element={createElement()}
				mode="live"
				isSelected={true}
				isActive={false}
				onChange={vi.fn()}
			/>,
		);

		// Full editor shows the toolbar/header elements
		expect(screen.getAllByLabelText('Rich text title')[0]).not.toBeNull();
	});

	it('renders full editor when mode is shell', () => {
		render(
			<LexicalNote
				element={createElement()}
				mode="shell"
				isSelected={true}
				isActive={false}
				onChange={vi.fn()}
			/>,
		);

		// Full editor shows the toolbar/header elements
		expect(screen.getAllByLabelText('Rich text title')[0]).not.toBeNull();
	});
});
