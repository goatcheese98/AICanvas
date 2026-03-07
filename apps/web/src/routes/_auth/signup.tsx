import { createFileRoute } from '@tanstack/react-router';
import { SignUp } from '@clerk/clerk-react';

export const Route = createFileRoute('/_auth/signup')({
	component: SignupPage,
});

function SignupPage() {
	return <SignUp routing="path" path="/signup" signInUrl="/login" />;
}
