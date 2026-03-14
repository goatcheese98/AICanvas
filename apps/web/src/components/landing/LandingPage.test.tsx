// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { LandingPage } from './LandingPage';

afterEach(() => {
	cleanup();
});

describe('LandingPage', () => {
	it('renders the scrollytelling landing page with the sticky canvas story and waitlist form', () => {
		render(<LandingPage />);

		expect(
			screen.getByRole('heading', {
				name: /one canvas for rough ideas, research, plans, and polished work\./i,
			}),
		).toBeTruthy();
		expect(screen.getByRole('link', { name: /roopstudio/i })).toBeTruthy();
		expect(screen.getAllByText(/capture fragments before they disappear/i).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/build context next to the idea, not in another tool/i).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/shape momentum with boards, timelines, and next steps/i).length,
		).toBeGreaterThan(0);
		expect(screen.getByRole('form', { name: /landing waitlist form/i })).toBeTruthy();
		expect(screen.getByLabelText(/work email/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /request access/i })).toBeTruthy();
	});

	it('keeps the primary intro actions and waitlist anchor wired correctly', () => {
		render(<LandingPage />);

		const navigation = screen.getByRole('navigation', { name: /landing/i });

		expect(screen.getByRole('link', { name: /join waitlist/i }).getAttribute('href')).toBe('#waitlist');
		expect(screen.getAllByRole('link', { name: /^sign in$/i })[0]?.getAttribute('href')).toBe('/login');
		expect(within(navigation).getByRole('link', { name: /canvas story/i }).getAttribute('href')).toBe(
			'#capture',
		);
		expect(within(navigation).getByRole('link', { name: /^waitlist$/i }).getAttribute('href')).toBe(
			'#waitlist',
		);
	});
});
