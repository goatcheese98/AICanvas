import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LandingPage } from './LandingPage';

afterEach(() => {
	cleanup();
});

describe('LandingPage', () => {
	it('renders only the first landing scene without scrollytelling or assistant UI', () => {
		render(<LandingPage />);

		expect(
			screen.getByRole('heading', {
				name: /one canvas for rough ideas, research, plans, and polished work\./i,
			}),
		).toBeTruthy();
		expect(screen.getByRole('link', { name: /roopstudio/i })).toBeTruthy();
		expect(screen.getByText(/loose notes and references/i)).toBeTruthy();
		expect(screen.getByText(/course notes, links, and half-formed ideas/i)).toBeTruthy();
		expect(screen.getByText(/drop in screenshots, prompts, notes, and quick ideas/i)).toBeTruthy();
		expect(screen.queryByText(/a next-generation canvas for ideas/i)).toBeNull();
		expect(screen.queryByText(/assistant/i)).toBeNull();
		expect(screen.queryByRole('form', { name: /landing waitlist form/i })).toBeNull();
	});

	it('keeps the intro actions simple', () => {
		render(<LandingPage />);

		expect(screen.getByRole('link', { name: /join waitlist/i }).getAttribute('href')).toBe('#waitlist');
		expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/login');
		expect(screen.getAllByRole('button', { hidden: true })).toHaveLength(13);
	});
});
