import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LandingPage } from './LandingPage';

const originalFetch = globalThis.fetch;

beforeEach(() => {
	Object.defineProperty(window, 'scrollTo', {
		value: vi.fn(),
		writable: true,
	});
});

afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('LandingPage', () => {
	it('renders the board-first journey with the story embedded on the canvas', () => {
		render(<LandingPage />);

		expect(
			screen.getByRole('heading', {
				name: /one canvas for rough ideas, research, plans, and polished work\./i,
			}),
		).toBeTruthy();
		expect(screen.getByText(/scroll to follow the board/i)).toBeTruthy();
		expect(
			screen.getByText(/a next-generation canvas for ideas, making, and shared progress/i),
		).toBeTruthy();
		expect(screen.getByRole('link', { name: /roopstudio/i })).toBeTruthy();
		expect(screen.getByText(/start anywhere/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /go to use ai in place/i })).toBeTruthy();
		expect(screen.queryByText(/ai-native product workspace/i)).toBeNull();
		expect(screen.getAllByRole('form')).toHaveLength(1);
	});

	it('shows client-side validation feedback for invalid emails', async () => {
		render(<LandingPage />);

		const waitlistForm = screen.getByRole('form', { name: /landing waitlist form/i });
		const emailField = within(waitlistForm).getByLabelText(/work email/i);

		fireEvent.change(emailField, { target: { value: 'not-an-email' } });
		fireEvent.submit(waitlistForm);

		expect(await within(waitlistForm).findByText(/enter a valid work email address/i)).toBeTruthy();
	});

	it('scrolls to the AI scene from the hero CTA', () => {
		render(<LandingPage />);

		fireEvent.click(screen.getByRole('button', { name: /see it in action/i }));

		expect(window.scrollTo).toHaveBeenCalledWith(
			expect.objectContaining({
				behavior: 'smooth',
			}),
		);
	});

	it('keeps only one waitlist form on the page and shows the join action', () => {
		render(<LandingPage />);

		expect(screen.queryByRole('form', { name: /hero waitlist form/i })).toBeNull();
		expect(screen.getByRole('link', { name: /join waitlist/i })).toBeTruthy();
	});

	it('submits the waitlist form with the landing footer source', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					status: 'created',
					message: "Thanks for joining. We'll be in touch soon.",
				}),
				{ status: 201, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;

		render(<LandingPage />);

		const waitlistForm = screen.getByRole('form', { name: /landing waitlist form/i });
		const emailField = within(waitlistForm).getByLabelText(/work email/i);

		fireEvent.change(emailField, { target: { value: 'footer@roopstudio.com' } });
		fireEvent.submit(waitlistForm);

		await waitFor(() =>
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/waitlist',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({
						email: 'footer@roopstudio.com',
						source: 'landing-footer',
					}),
				}),
			),
		);
		expect(await within(waitlistForm).findByText(/thanks for joining/i)).toBeTruthy();
	});

	it('submits the waitlist form with the landing footer source and handles duplicates', async () => {
		globalThis.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					status: 'duplicate',
					message: "You're already on the RoopStudio waitlist.",
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;

		render(<LandingPage />);

		const waitlistForm = screen.getByRole('form', { name: /landing waitlist form/i });
		const emailField = within(waitlistForm).getByLabelText(/work email/i);

		fireEvent.change(emailField, { target: { value: 'footer@roopstudio.com' } });
		fireEvent.submit(waitlistForm);

		await waitFor(() =>
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/waitlist',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({
						email: 'footer@roopstudio.com',
						source: 'landing-footer',
					}),
				}),
			),
		);
		expect(await within(waitlistForm).findByText(/already on the roopstudio waitlist/i)).toBeTruthy();
	});
});
