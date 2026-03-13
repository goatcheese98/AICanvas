import { SignUp } from '@clerk/clerk-react';

export function SignupPage() {
	return <SignUp routing="path" path="/signup" signInUrl="/login" />;
}
