import { createFileRoute } from '@tanstack/react-router';
import { SignIn } from '@clerk/clerk-react';

export const Route = createFileRoute('/_auth/login')({
	component: LoginPage,
});

function LoginPage() {
	return <SignIn routing="path" path="/login" signUpUrl="/signup" />;
}
