// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './-login-view';
import { SignupPage } from './-signup-view';

const signInSpy = vi.fn();
const signUpSpy = vi.fn();

vi.mock('@clerk/clerk-react', () => ({
	SignIn: (props: Record<string, unknown>) => {
		signInSpy(props);
		return <div data-testid="mock-sign-in" />;
	},
	SignUp: (props: Record<string, unknown>) => {
		signUpSpy(props);
		return <div data-testid="mock-sign-up" />;
	},
}));

describe('auth views', () => {
	it('routes login through Clerk and falls back to the dashboard after sign-in', () => {
		render(<LoginPage />);

		expect(signInSpy).toHaveBeenCalledOnce();
		expect(signInSpy.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				routing: 'path',
				path: '/login',
				signUpUrl: '/signup',
				fallbackRedirectUrl: '/dashboard',
				signUpFallbackRedirectUrl: '/dashboard',
			}),
		);
	});

	it('routes signup through Clerk and falls back to the dashboard after sign-up', () => {
		render(<SignupPage />);

		expect(signUpSpy).toHaveBeenCalledOnce();
		expect(signUpSpy.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				routing: 'path',
				path: '/signup',
				signInUrl: '/login',
				fallbackRedirectUrl: '/dashboard',
				signInFallbackRedirectUrl: '/dashboard',
			}),
		);
	});
});
