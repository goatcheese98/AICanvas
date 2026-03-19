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

	it('resets local editor state when the upstream note snapshot changes', () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<MarkdownNoteContainer
				element={createElement()}
				mode="live"
				isSelected
				isActive
				onChange={onChange}
			/>,
		);

		fireEvent.change(screen.getByPlaceholderText('Write markdown...'), {
			target: { value: 'Locally edited body' },
		});

		rerender(
			<MarkdownNoteContainer
				element={createElement({
					title: 'Synced',
					content: 'Server truth',
				})}
				mode="live"
				isSelected
				isActive
				onChange={onChange}
			/>,
		);

		expect(screen.getByDisplayValue('Synced')).toBeTruthy();
		expect(screen.getByDisplayValue('Server truth')).toBeTruthy();
	});

	it('shows exact size values, hides edges, and detaches the style panel on small notes', () => {
		render(
			<MarkdownNoteContainer
				element={{
					...createElement({
						settings: {
							fontSize: 16,
							lineHeight: 1.6,
							autoHideToolbar: false,
							background: '#ffffff',
							font: 'system-ui',
							inlineCodeColor: '#334155',
							showEmptyLines: true,
						},
					}),
					width: 420,
				}}
				mode="live"
				isSelected
				isActive
				onChange={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Options' }));

		expect(screen.getByText('16px')).toBeTruthy();
		expect(screen.getByText('1.60x')).toBeTruthy();
		expect(screen.queryByText('Edges')).toBeNull();
		expect(screen.getByTestId('markdown-style-panel').className).toContain('absolute');
	});

	it('keeps the detached style panel open while changing font, size, leading, and inline color', () => {
		render(
			<MarkdownNoteContainer
				element={{
					...createElement({
						settings: {
							fontSize: 16,
							lineHeight: 1.6,
							autoHideToolbar: false,
							background: '#ffffff',
							font: 'system-ui',
							inlineCodeColor: '#334155',
							showEmptyLines: true,
						},
					}),
					width: 420,
				}}
				mode="live"
				isSelected
				isActive
				onChange={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Options' }));
		const panel = () => screen.getByTestId('markdown-style-panel');
		const getRanges = () =>
			Array.from(panel().querySelectorAll('input[type="range"]')) as HTMLInputElement[];
		const getColors = () =>
			Array.from(panel().querySelectorAll('input[type="color"]')) as HTMLInputElement[];

		fireEvent.change(screen.getByRole('combobox'), {
			target: { value: 'Georgia, serif' },
		});
		expect(panel()).toBeTruthy();

		fireEvent.change(getRanges()[1] as HTMLInputElement, {
			target: { value: '20' },
		});
		expect(panel()).toBeTruthy();

		fireEvent.change(getRanges()[2] as HTMLInputElement, {
			target: { value: '1.85' },
		});
		expect(panel()).toBeTruthy();

		fireEvent.change(getColors()[2] as HTMLInputElement, {
			target: { value: '#112233' },
		});
		expect(panel()).toBeTruthy();
	});

	it('boosts readability in shell mode without changing the note settings', () => {
		render(
			<MarkdownNoteContainer
				element={createElement({
					settings: {
						fontSize: 16,
						lineHeight: 1.6,
						autoHideToolbar: false,
						background: '#ffffff',
						font: 'system-ui',
						inlineCodeColor: '#334155',
						showEmptyLines: true,
					},
				})}
				mode="shell"
				isSelected
				isActive
				onChange={vi.fn()}
			/>,
		);

		const editor = screen.getByPlaceholderText('Write markdown...') as HTMLTextAreaElement;
		expect(editor.style.fontSize).toBe('22px');
		expect(editor.style.lineHeight).toBe('1.7');

		fireEvent.click(screen.getByRole('button', { name: 'Options' }));
		expect(screen.getByText(/expanded view automatically boosts text size/i)).toBeTruthy();
	});
});
