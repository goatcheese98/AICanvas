import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeftSidebar } from './LeftSidebar';
import type { ProjectResource } from './types';

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
	useUser: () => ({
		user: {
			id: 'user-1',
			fullName: 'Test User',
			firstName: 'Test',
			username: 'testuser',
			imageUrl: null,
		},
	}),
}));

const mockResources: ProjectResource[] = [
	{ id: '1', name: 'Canvas 1', type: 'canvas' },
	{ id: '2', name: 'Board 1', type: 'board' },
];

const defaultProps = {
	isExpanded: true,
	onToggleExpand: vi.fn(),
	projectName: 'Test Project',
	resources: mockResources,
	activeResourceId: '1',
	onResourceClick: vi.fn(),
	onNewResource: vi.fn(),
	onNavigateToSettings: vi.fn(),
	collaboration: {
		isCollaborating: false,
		collaborators: [] as { id: string; name: string; avatarUrl?: string; isOnline?: boolean }[],
		roomLink: null as string | null,
		username: 'Test User',
		setUsername: vi.fn(),
		startSession: vi.fn(),
		stopSession: vi.fn(),
	},
};

describe('LeftSidebar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	describe('basic rendering', () => {
		it('renders project name when expanded', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			expect(container.textContent).toContain('Test Project');
		});

		it('renders resources list', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			expect(container.textContent).toContain('Canvas 1');
			expect(container.textContent).toContain('Board 1');
		});

		it('calls onToggleExpand when toggle button clicked', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const toggleButton = container.querySelector('[aria-label="Collapse sidebar"]');
			if (toggleButton) fireEvent.click(toggleButton);
			expect(defaultProps.onToggleExpand).toHaveBeenCalledTimes(1);
		});

		it('shows expand label when collapsed', () => {
			const { container } = render(<LeftSidebar {...defaultProps} isExpanded={false} />);
			expect(container.querySelector('[aria-label="Expand sidebar"]')).toBeDefined();
		});

		it('opens the new resource menu when New is clicked', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const newButton = container.querySelector('[aria-label="Open new resource menu"]');
			if (newButton) fireEvent.click(newButton);

			expect(
				document.querySelector('[role="menu"][aria-label="Create new resource"]'),
			).toBeDefined();
			expect(document.body.textContent).toContain('New Board');
		});

		it('routes new resource menu selections through onNewResource', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const newButton = container.querySelector('[aria-label="Open new resource menu"]');
			if (newButton) fireEvent.click(newButton);

			const boardButton = Array.from(document.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('New Board'),
			);
			if (boardButton) fireEvent.click(boardButton);

			expect(defaultProps.onNewResource).toHaveBeenCalledWith({ type: 'board' });
		});
	});

	describe('footer popover', () => {
		it('opens popover when footer button clicked', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);
			expect(container.querySelector('[role="dialog"]')).toBeDefined();
		});

		it('closes popover when backdrop clicked', async () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			const backdrop = container.querySelector('[aria-label="Close menu"]');
			if (backdrop) fireEvent.click(backdrop as Element);

			await waitFor(() => {
				expect(container.querySelector('[role="dialog"]')).toBeNull();
			});
		});

		it('closes popover on escape key', async () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			fireEvent.keyDown(document, { key: 'Escape' });

			await waitFor(() => {
				expect(container.querySelector('[role="dialog"]')).toBeNull();
			});
		});

		it('has correct ARIA attributes', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			expect(footerButton?.getAttribute('aria-haspopup')).toBe('dialog');
			expect(footerButton?.getAttribute('aria-expanded')).toBe('false');

			if (footerButton) fireEvent.click(footerButton);
			expect(footerButton?.getAttribute('aria-expanded')).toBe('true');
		});
	});

	describe('presence indicators', () => {
		it('shows offline state when not collaborating', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);
			expect(container.textContent).toContain('Working solo');
		});

		it('shows online state when collaborating', () => {
			const { container } = render(
				<LeftSidebar
					{...defaultProps}
					collaboration={{ ...defaultProps.collaboration, isCollaborating: true }}
				/>,
			);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);
			expect(container.textContent).toContain('Live session active');
		});
	});

	describe('collaborators empty state', () => {
		it('shows empty state when no collaborators', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			expect(container.textContent).toContain('No collaborators yet');
			expect(container.textContent).toContain('Start a live session to invite others');
		});

		it('shows collaborators list when present', () => {
			const collaborators = [
				{ id: 'c1', name: 'Alice', isOnline: true },
				{ id: 'c2', name: 'Bob', isOnline: false },
			];
			const { container } = render(
				<LeftSidebar
					{...defaultProps}
					collaboration={{ ...defaultProps.collaboration, collaborators }}
				/>,
			);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			expect(container.textContent).toContain('Alice');
			expect(container.textContent).toContain('Bob');
			expect(container.textContent).not.toContain('No collaborators yet');
		});
	});

	describe('share/session controls', () => {
		it('shows start session button when no room link', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			expect(container.textContent).toContain('Start Live Session');
		});

		it('shows room link and end session when session active', () => {
			const { container } = render(
				<LeftSidebar
					{...defaultProps}
					collaboration={{
						...defaultProps.collaboration,
						roomLink: 'https://example.com/room/abc123',
						isCollaborating: true,
					}}
				/>,
			);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			expect(container.textContent).toContain('https://example.com/room/abc123');
			expect(container.textContent).toContain('Copy');
			expect(container.textContent).toContain('End Session');
		});

		it('calls startSession when start button clicked', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			const startButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Start Live Session'),
			);
			if (startButton) fireEvent.click(startButton);

			expect(defaultProps.collaboration.startSession).toHaveBeenCalledTimes(1);
		});
	});

	describe('settings navigation', () => {
		it('calls onNavigateToSettings when settings clicked', async () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			const settingsButton = Array.from(container.querySelectorAll('button')).find((btn) =>
				btn.textContent?.includes('Settings'),
			);
			if (settingsButton) fireEvent.click(settingsButton);

			await waitFor(() => {
				expect(defaultProps.onNavigateToSettings).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe('display name input', () => {
		it('shows display name input', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			expect(container.querySelector('label[for="display-name"]')).toBeDefined();
			expect(container.querySelector('input[value="Test User"]')).toBeDefined();
		});

		it('calls setUsername when input changes', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			const input = container.querySelector('#display-name') as HTMLInputElement;
			if (input) fireEvent.change(input, { target: { value: 'New Name' } });

			expect(defaultProps.collaboration.setUsername).toHaveBeenCalledWith('New Name');
		});
	});

	describe('mobile responsiveness', () => {
		it('popover has responsive width classes', () => {
			const { container } = render(<LeftSidebar {...defaultProps} />);
			const footerButton = container.querySelector('[aria-haspopup="dialog"]');
			if (footerButton) fireEvent.click(footerButton);

			const dialog = container.querySelector('[role="dialog"]');
			expect(dialog?.className).toContain('sm:w-72');
		});
	});
});
