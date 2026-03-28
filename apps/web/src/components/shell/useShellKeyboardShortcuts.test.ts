// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShellKeyboardShortcuts } from './useShellKeyboardShortcuts';

describe('useShellKeyboardShortcuts', () => {
	const mockToggleRightPanel = vi.fn();
	const mockCloseRightPanel = vi.fn();
	const mockToggleSidebar = vi.fn();
	const mockOpenRightPanel = vi.fn();
	const mockOpenShortcutsHelp = vi.fn();

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	const fireKeyDown = (
		key: string,
		options?: { metaKey?: boolean; ctrlKey?: boolean; target?: EventTarget },
	) => {
		// Default target to document.body when not specified (matches real browser behavior)
		const target = options?.target ?? document.body;
		const event = new KeyboardEvent('keydown', {
			key,
			metaKey: options?.metaKey,
			ctrlKey: options?.ctrlKey,
			bubbles: true,
		});
		// Dispatch from the target element to properly set the event target
		target.dispatchEvent(event);
	};

	it('toggles AI panel with Cmd/Ctrl+B', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
			}),
		);

		fireKeyDown('b', { metaKey: true });
		expect(mockToggleRightPanel).toHaveBeenCalledWith('ai');

		vi.clearAllMocks();
		fireKeyDown('b', { ctrlKey: true });
		expect(mockToggleRightPanel).toHaveBeenCalledWith('ai');
	});

	it('toggles Details panel with Cmd/Ctrl+I', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
			}),
		);

		fireKeyDown('i', { metaKey: true });
		expect(mockToggleRightPanel).toHaveBeenCalledWith('details');

		vi.clearAllMocks();
		fireKeyDown('i', { ctrlKey: true });
		expect(mockToggleRightPanel).toHaveBeenCalledWith('details');
	});

	it('toggles sidebar with Cmd/Ctrl+[', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
			}),
		);

		fireKeyDown('[', { metaKey: true });
		expect(mockToggleSidebar).toHaveBeenCalledTimes(1);

		vi.clearAllMocks();
		fireKeyDown('[', { ctrlKey: true });
		expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
	});

	it('closes right panel with Escape when panel is open', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'ai',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
			}),
		);

		fireKeyDown('Escape');
		expect(mockCloseRightPanel).toHaveBeenCalledTimes(1);
	});

	it('does not call closeRightPanel when help is open', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'ai',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
				onOpenShortcutsHelp: mockOpenShortcutsHelp,
				isShortcutsHelpOpen: true,
			}),
		);

		fireKeyDown('Escape');
		expect(mockCloseRightPanel).not.toHaveBeenCalled();
	});

	it('opens shortcuts help with ? key', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
				onOpenShortcutsHelp: mockOpenShortcutsHelp,
				isShortcutsHelpOpen: false,
			}),
		);

		fireKeyDown('?');
		expect(mockOpenShortcutsHelp).toHaveBeenCalledTimes(1);
	});

	it('does not open shortcuts help when already open', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
				onOpenShortcutsHelp: mockOpenShortcutsHelp,
				isShortcutsHelpOpen: true,
			}),
		);

		fireKeyDown('?');
		expect(mockOpenShortcutsHelp).not.toHaveBeenCalled();
	});

	it('does not open shortcuts help when typing in input', () => {
		const input = document.createElement('input');
		document.body.appendChild(input);

		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
				onOpenShortcutsHelp: mockOpenShortcutsHelp,
				isShortcutsHelpOpen: false,
			}),
		);

		fireKeyDown('?', { target: input });
		expect(mockOpenShortcutsHelp).not.toHaveBeenCalled();

		document.body.removeChild(input);
	});

	it('does not open shortcuts help when typing in textarea', () => {
		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);

		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
				onOpenShortcutsHelp: mockOpenShortcutsHelp,
				isShortcutsHelpOpen: false,
			}),
		);

		fireKeyDown('?', { target: textarea });
		expect(mockOpenShortcutsHelp).not.toHaveBeenCalled();

		document.body.removeChild(textarea);
	});

	it('does not open shortcuts help with modifier key', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
				onOpenShortcutsHelp: mockOpenShortcutsHelp,
				isShortcutsHelpOpen: false,
			}),
		);

		fireKeyDown('?', { metaKey: true });
		expect(mockOpenShortcutsHelp).not.toHaveBeenCalled();
	});

	it('does not throw when onOpenShortcutsHelp is not provided', () => {
		renderHook(() =>
			useShellKeyboardShortcuts({
				rightPanelMode: 'none',
				openRightPanel: mockOpenRightPanel,
				closeRightPanel: mockCloseRightPanel,
				toggleRightPanel: mockToggleRightPanel,
				toggleSidebar: mockToggleSidebar,
			}),
		);

		// Should not throw error
		expect(() => fireKeyDown('?')).not.toThrow();
	});
});
