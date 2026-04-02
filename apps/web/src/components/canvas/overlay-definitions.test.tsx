import type {
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	NewLexOverlayCustomData,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
	type TypedOverlayCanvasElement,
	getOverlayDefinition,
	normalizeOverlayElement,
} from './overlay-definitions';

afterEach(() => {
	cleanup();
});

function createMarkdownOverlay(
	overrides?: Partial<MarkdownOverlayCustomData>,
): TypedOverlayCanvasElement<MarkdownOverlayCustomData> {
	return {
		id: 'markdown-overlay',
		type: 'rectangle',
		x: 100,
		y: 120,
		width: 420,
		height: 300,
		angle: 0,
		strokeColor: '#111827',
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
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
			type: 'markdown',
			title: 'Note',
			content: 'Hello',
			...overrides,
		},
	} as ExcalidrawElement as TypedOverlayCanvasElement<MarkdownOverlayCustomData>;
}

function createPrototypeOverlay(
	overrides?: Partial<PrototypeOverlayCustomData>,
): TypedOverlayCanvasElement<PrototypeOverlayCustomData> {
	return {
		id: 'prototype-overlay',
		type: 'rectangle',
		x: 100,
		y: 120,
		width: 520,
		height: 320,
		angle: 0,
		strokeColor: '#111827',
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
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
			type: 'prototype',
			title: 'Checkout Flow',
			template: 'react',
			activeFile: 'App.tsx',
			files: {
				'App.tsx': {
					code: 'export default function App() { return null; }',
					active: true,
				},
			},
			dependencies: {
				react: '^19.0.0',
			},
			preview: {
				title: 'Checkout Flow',
				description: 'Mobile checkout concept',
				badges: ['Mobile', 'Payments'],
				metrics: [{ label: 'Screens', value: '4' }],
			},
			...overrides,
		},
	} as ExcalidrawElement as TypedOverlayCanvasElement<PrototypeOverlayCustomData>;
}

function createDocumentOverlay(
	overrides?: Partial<NewLexOverlayCustomData>,
): TypedOverlayCanvasElement<NewLexOverlayCustomData> {
	return {
		id: 'document-overlay',
		type: 'rectangle',
		x: 80,
		y: 100,
		width: 420,
		height: 300,
		angle: 0,
		strokeColor: '#111827',
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
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
			title: 'Project Notes',
			lexicalState:
				'{"root":{"children":[{"type":"paragraph","version":1,"children":[{"text":"Preview only text."}]}],"type":"root","version":1}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
			...overrides,
		},
	} as ExcalidrawElement as TypedOverlayCanvasElement<NewLexOverlayCustomData>;
}

function createBoardOverlay(
	overrides?: Partial<KanbanOverlayCustomData>,
): TypedOverlayCanvasElement<KanbanOverlayCustomData> {
	return {
		id: 'board-overlay',
		type: 'rectangle',
		x: 60,
		y: 90,
		width: 520,
		height: 320,
		angle: 0,
		strokeColor: '#111827',
		backgroundColor: '#ffffff',
		fillStyle: 'solid',
		strokeWidth: 1,
		strokeStyle: 'solid',
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
			type: 'kanban',
			title: 'Launch Board',
			columns: [{ id: 'todo', title: 'Todo', cards: [] }],
			bgTheme: 'parchment',
			fontId: 'excalifont',
			fontSize: 13,
			...overrides,
		},
	} as ExcalidrawElement as TypedOverlayCanvasElement<KanbanOverlayCustomData>;
}

describe('normalizeOverlayElement', () => {
	it('returns a fresh normalized object for each call so in-place element mutation cannot stale the overlay layer', () => {
		const element = createMarkdownOverlay();

		const first = normalizeOverlayElement('markdown', element);
		const second = normalizeOverlayElement('markdown', element);

		expect(first).not.toBe(second);
		expect(second.customData).not.toBe(first.customData);
	});

	it('returns a new normalized object for a new element instance', () => {
		const firstElement = createMarkdownOverlay();
		const secondElement = createMarkdownOverlay({
			content: 'Updated content',
		});

		const first = normalizeOverlayElement('markdown', firstElement);
		const second = normalizeOverlayElement('markdown', secondElement);

		expect(first).not.toBe(second);
		expect(second.customData.content).toBe('Updated content');
	});

	it('reflects in-place mutations on the same element instance', () => {
		const element = createMarkdownOverlay();
		const first = normalizeOverlayElement('markdown', element);

		(element as { x: number }).x = 320;
		(element as { customData: Record<string, unknown> }).customData = {
			...element.customData,
			content: 'Changed while dragging',
		};

		const second = normalizeOverlayElement('markdown', element);

		expect(second.x).toBe(320);
		expect(second.customData.content).toBe('Changed while dragging');
		expect(first.x).toBe(100);
		expect(first.customData.content).toBe('Hello');
	});

	it('returns the same markdown element instance for a no-op update', () => {
		const settings = {
			font: 'Nunito, "Segoe UI Emoji", sans-serif',
			fontSize: 14,
			background: '#ffffff',
			lineHeight: 1.65,
			inlineCodeColor: '#334155',
			showEmptyLines: true,
			autoHideToolbar: false,
		};
		const element = createMarkdownOverlay({
			editorMode: 'raw',
			images: {},
			settings,
		});

		const updated = getOverlayDefinition('markdown').applyUpdate(element, {
			title: 'Note',
			content: 'Hello',
			images: {},
			settings,
			editorMode: 'raw',
		});

		expect(updated).toBe(element);
	});

	it('renders the prototype preview card from the overlay definition', () => {
		const element = createPrototypeOverlay();

		render(
			getOverlayDefinition('prototype').render({
				element,
				isSelected: false,
				isActive: false,
				mode: 'preview',
				onChange: () => {},
				onActivityChange: () => {},
			}),
		);

		expect(screen.getByText('Checkout Flow')).toBeTruthy();
		expect(screen.getByText('react')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Open Prototype' })).toBeTruthy();
	});

	it('prefers resource snapshot metadata for prototype preview cards', () => {
		const element = createPrototypeOverlay({
			title: 'Legacy prototype title',
			resourceSnapshot: {
				resourceType: 'prototype',
				resourceId: 'prototype-1',
				title: 'Snapshot prototype title',
				snapshotVersion: 1,
				display: {
					badge: 'New',
					subtitle: 'Prototype',
					summary: '1 file',
				},
			},
		});

		render(
			getOverlayDefinition('prototype').render({
				element,
				isSelected: false,
				isActive: false,
				mode: 'preview',
				onChange: () => {},
				onActivityChange: () => {},
			}),
		);

		expect(screen.getByText('Snapshot prototype title')).toBeTruthy();
		expect(screen.getByText('New')).toBeTruthy();
		expect(screen.getByText('1 file')).toBeTruthy();
		expect(screen.queryByText('Legacy prototype title')).toBeNull();
	});

	it('renders document overlays as preview cards even in shell mode', () => {
		const element = createDocumentOverlay();

		render(
			getOverlayDefinition('newlex').render({
				element,
				isSelected: true,
				isActive: true,
				mode: 'shell',
				onChange: () => {},
				onActivityChange: () => {},
			}),
		);

		expect(screen.getByText('Project Notes')).toBeTruthy();
		expect(screen.getByText('Preview only text.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Open Document' })).toBeTruthy();
	});

	it('renders board overlays as preview cards even in shell mode', () => {
		const element = createBoardOverlay();

		render(
			getOverlayDefinition('kanban').render({
				element,
				isSelected: true,
				isActive: true,
				mode: 'shell',
				onChange: () => {},
				onActivityChange: () => {},
			}),
		);

		expect(screen.getByText('Launch Board')).toBeTruthy();
		expect(screen.getByText('1 column')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Open Board' })).toBeTruthy();
	});
});
