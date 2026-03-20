// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redirectToUserProfileSpy = vi.fn();
const signOutSpy = vi.fn();

vi.mock('@clerk/clerk-react', () => ({
	useClerk: () => ({
		redirectToUserProfile: redirectToUserProfileSpy,
		signOut: signOutSpy,
	}),
	useAuth: () => ({
		getToken: vi.fn(async () => 'token'),
		isSignedIn: true,
	}),
	useUser: () => ({
		user: {
			firstName: 'Rohan',
			fullName: 'Rohan Jasani',
			username: 'rohan',
			primaryEmailAddress: {
				emailAddress: 'rohan@example.com',
			},
			imageUrl: null,
		},
	}),
}));

vi.mock('./CanvasLibrary', () => ({
	CanvasLibrary: () => <div data-testid="canvas-library" />,
}));

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
	useRouter: () => ({}),
}));

const { Dashboard } = await import('./Dashboard');

function renderWithQueryClient(children: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

beforeEach(() => {
	redirectToUserProfileSpy.mockClear();
	signOutSpy.mockClear();
	window.localStorage.clear();
});

afterEach(() => {
	cleanup();
});

describe('Dashboard', () => {
	it('shows the full profile chip by default and lets the user sign out', () => {
		renderWithQueryClient(<Dashboard />);

		expect(screen.getByText('Rohan Jasani')).toBeTruthy();
		expect(screen.getByText('rohan@example.com')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
		fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

		expect(signOutSpy).toHaveBeenCalledOnce();
	});

	it('routes manage account through Clerk from the profile menu', () => {
		renderWithQueryClient(<Dashboard />);

		fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
		fireEvent.click(screen.getByRole('button', { name: /manage account/i }));

		expect(redirectToUserProfileSpy).toHaveBeenCalledOnce();
	});

	it('keeps settings inside the same panel and lets the user go back out', () => {
		renderWithQueryClient(<Dashboard />);

		fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
		fireEvent.click(screen.getByRole('button', { name: /workspace settings/i }));

		expect(screen.getByRole('dialog', { name: 'Workspace settings' })).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

		expect(screen.getByRole('dialog', { name: 'Profile menu' })).toBeTruthy();
		expect(screen.getByRole('button', { name: /manage account/i })).toBeTruthy();
	});
});
