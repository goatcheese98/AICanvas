// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

afterEach(() => {
	cleanup();
});

describe('LandingPage', () => {
	it('renders the scrollytelling landing page with the sticky canvas story and waitlist form', () => {
		render(<LandingPage />);

		expect(screen.getByRole('heading', { name: /roopstudio ai canvas/i })).toBeTruthy();

		expect(screen.getByRole('link', { name: /roopstudio/i })).toBeTruthy();
		// Hero description text (may appear in multiple places)
		expect(screen.getAllByText(/visual workspace/i).length).toBeGreaterThan(0);
		expect(screen.getByLabelText(/workflow summary/i)).toBeTruthy();
		expect(screen.getByText(/outputs inherit the context/i)).toBeTruthy();
		// Waitlist form elements
		expect(screen.getByRole('form', { name: /landing waitlist form/i })).toBeTruthy();
		expect(screen.getByLabelText(/work email/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /request access/i })).toBeTruthy();
	});

	it('keeps the primary intro actions and waitlist anchor wired correctly', () => {
		render(<LandingPage />);

		const navigation = screen.getByRole('navigation', { name: /landing/i });

		expect(screen.getByRole('link', { name: /request access/i }).getAttribute('href')).toBe(
			'#waitlist',
		);
		expect(screen.getAllByRole('link', { name: /^sign in$/i })[0]?.getAttribute('href')).toBe(
			'/login',
		);
		expect(within(navigation).getByRole('button', { name: /canvas story/i })).toBeTruthy();
		expect(within(navigation).getByRole('button', { name: /^waitlist$/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /01 gather/i })).toBeTruthy();
	});
});
