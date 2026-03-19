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

		// Main hero heading in sidebar (may appear multiple times in cards)
		const heroHeadings = screen.getAllByRole('heading', {
			name: /one canvas for rough ideas, research, plans, and polished work/i,
		});
		expect(heroHeadings.length).toBeGreaterThan(0);
		
		expect(screen.getByRole('link', { name: /roopstudio/i })).toBeTruthy();
		// Hero description text (may appear in multiple places)
		expect(screen.getAllByText(/keep early fragments/i).length).toBeGreaterThan(0);
		// Waitlist form elements
		expect(screen.getByRole('form', { name: /landing waitlist form/i })).toBeTruthy();
		expect(screen.getByLabelText(/work email/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /request access/i })).toBeTruthy();
	});

	it('keeps the primary intro actions and waitlist anchor wired correctly', () => {
		render(<LandingPage />);

		const navigation = screen.getByRole('navigation', { name: /landing/i });

		expect(screen.getByRole('link', { name: /join waitlist/i }).getAttribute('href')).toBe(
			'#waitlist',
		);
		expect(screen.getAllByRole('link', { name: /^sign in$/i })[0]?.getAttribute('href')).toBe(
			'/login',
		);
		expect(
			within(navigation)
				.getByRole('link', { name: /canvas story/i })
				.getAttribute('href'),
		).toBe('#capture');
		expect(
			within(navigation)
				.getByRole('link', { name: /^waitlist$/i })
				.getAttribute('href'),
		).toBe('#waitlist');
	});
});
