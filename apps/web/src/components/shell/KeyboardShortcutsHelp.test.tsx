// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

describe('KeyboardShortcutsHelp', () => {
	const mockOnClose = vi.fn();

	afterEach(() => {
		cleanup();
		mockOnClose.mockClear();
		// Reset body overflow after each test
		document.body.style.overflow = '';
	});

	it('renders nothing when closed', () => {
		const { container } = render(<KeyboardShortcutsHelp isOpen={false} onClose={mockOnClose} />);

		expect(container.firstChild).toBeNull();
	});

	it('renders when open', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		expect(screen.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeTruthy();
		// Check for the tip text in the subtitle area (text is split by kbd element)
		expect(screen.getByText(/Press /)).toBeTruthy();
		expect(screen.getByText(/to open this help anytime/)).toBeTruthy();
	});

	it('displays all shortcut groups', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByText('Navigation')).toBeTruthy();
		expect(within(dialog).getByText('Panels')).toBeTruthy();
		expect(within(dialog).getByText('Help')).toBeTruthy();
	});

	it('displays all shortcuts', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const dialog = screen.getByRole('dialog');

		// Navigation shortcuts
		expect(within(dialog).getByText('Toggle sidebar')).toBeTruthy();
		expect(within(dialog).getByText('Close panels / exit expanded view')).toBeTruthy();

		// Panel shortcuts
		expect(within(dialog).getByText('Open AI Assistant panel')).toBeTruthy();
		expect(within(dialog).getByText('Open Details panel')).toBeTruthy();

		// Help shortcut
		expect(within(dialog).getByText('Show keyboard shortcuts')).toBeTruthy();
	});

	it('calls onClose when clicking backdrop', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const backdrop = screen.getByRole('dialog');
		fireEvent.click(backdrop);

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when clicking close button', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const closeButton = screen.getByLabelText('Close');
		fireEvent.click(closeButton);

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when clicking Got it button', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const gotItButton = screen.getByRole('button', { name: 'Got it' });
		fireEvent.click(gotItButton);

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when pressing Escape', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		fireEvent.keyDown(window, { key: 'Escape' });

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('does not close when clicking content area', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const content = screen.getByRole('heading', { name: 'Keyboard Shortcuts' });
		fireEvent.click(content);

		expect(mockOnClose).not.toHaveBeenCalled();
	});

	it('has correct accessibility attributes', () => {
		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		const dialog = screen.getByRole('dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.getAttribute('aria-labelledby')).toBe('keyboard-shortcuts-title');

		const title = screen.getByRole('heading', { name: 'Keyboard Shortcuts' });
		expect(title.id).toBe('keyboard-shortcuts-title');
	});

	it('sets body overflow to hidden when open', () => {
		expect(document.body.style.overflow).toBe('');

		render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		expect(document.body.style.overflow).toBe('hidden');
	});

	it('restores original body overflow on unmount', () => {
		document.body.style.overflow = 'auto';

		const { unmount } = render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

		unmount();

		expect(document.body.style.overflow).toBe('auto');
	});
});
