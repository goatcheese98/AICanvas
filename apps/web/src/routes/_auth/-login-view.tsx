import { SignIn } from '@clerk/clerk-react';

export function LoginPage() {
	return <SignIn routing="path" path="/login" signUpUrl="/signup" />;
}
