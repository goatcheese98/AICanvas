// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

const redirectToUserProfileSpy = vi.fn();
const signOutSpy = vi.fn();

vi.mock('@clerk/clerk-react', () => ({
	useClerk: () => ({
		redirectToUserProfile: redirectToUserProfileSpy,
		signOut: signOutSpy,
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
		render(<Dashboard />);

		expect(screen.getByText('Rohan Jasani')).toBeTruthy();
		expect(screen.getByText('rohan@example.com')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
		fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

		expect(signOutSpy).toHaveBeenCalledOnce();
	});

	it('routes manage account through Clerk from the profile menu', () => {
		render(<Dashboard />);

		fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
		fireEvent.click(screen.getByRole('button', { name: /manage account/i }));

		expect(redirectToUserProfileSpy).toHaveBeenCalledOnce();
	});

	it('keeps settings inside the same panel and lets the user go back out', () => {
		render(<Dashboard />);

		fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
		fireEvent.click(screen.getByRole('button', { name: /workspace settings/i }));

		expect(screen.getByRole('dialog', { name: 'Workspace settings' })).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

		expect(screen.getByRole('dialog', { name: 'Profile menu' })).toBeTruthy();
		expect(screen.getByRole('button', { name: /manage account/i })).toBeTruthy();
	});
});
