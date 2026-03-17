import type { MarkdownOverlayCustomData } from '@ai-canvas/shared/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownNoteContainer } from './MarkdownNoteContainer';
import type { MarkdownNoteProps } from './markdown-note-types';

function createElement(
	customData?: Partial<MarkdownOverlayCustomData>,
): MarkdownNoteProps['element'] {
	return {
		id: 'markdown-element',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 420,
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
			type: 'markdown',
			title: 'Note',
			content: 'Hello world',
			editorMode: 'raw',
			settings: {
				fontSize: 16,
				lineHeight: 1.6,
				autoHideToolbar: true,
				background: '#ffffff',
				font: 'system-ui',
			},
			images: {},
			...customData,
		},
	} as MarkdownNoteProps['element'];
}

beforeEach(() => {
	class ResizeObserverMock {
		observe() {}
		disconnect() {}
	}

	vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('MarkdownNoteContainer', () => {
	it('commits content changes through the editor surface boundary', () => {
		vi.useFakeTimers();
		const onChange = vi.fn();

		render(
			<MarkdownNoteContainer
				element={createElement()}
				mode="live"
				isSelected
				isActive
				onChange={onChange}
			/>,
		);

		fireEvent.change(screen.getByPlaceholderText('Write markdown...'), {
			target: { value: 'Updated body copy' },
		});

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Updated body copy',
			expect.any(Object),
			'Note',
			expect.any(Object),
			'raw',
		);
	});

	it('commits before switching to preview and reports the activity lifecycle', () => {
		const onChange = vi.fn();
		const onActivityChange = vi.fn();

		render(
			<MarkdownNoteContainer
				element={createElement()}
				mode="live"
				isSelected
				isActive
				onChange={onChange}
				onActivityChange={onActivityChange}
			/>,
		);

		expect(onActivityChange).toHaveBeenLastCalledWith(true);
		expect(screen.getByPlaceholderText('Write markdown...')).not.toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

		expect(onChange).toHaveBeenCalledWith(
			'markdown-element',
			'Hello world',
			expect.any(Object),
			'Note',
			expect.any(Object),
			'raw',
		);
		expect(screen.queryByPlaceholderText('Write markdown...')).toBeNull();
		expect(onActivityChange).toHaveBeenLastCalledWith(false);
	});
});
