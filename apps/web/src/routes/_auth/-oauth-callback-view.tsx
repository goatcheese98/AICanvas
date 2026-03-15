import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';

export function AuthRedirectCallbackPage() {
	return (
		<AuthenticateWithRedirectCallback
			signInUrl="/login"
			signUpUrl="/signup"
			signInFallbackRedirectUrl="/dashboard"
			signUpFallbackRedirectUrl="/dashboard"
		/>
	);
}
