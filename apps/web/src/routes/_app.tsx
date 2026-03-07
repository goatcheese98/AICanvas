import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@clerk/clerk-react';

export const Route = createFileRoute('/_app')({
	component: AppLayout,
});

function AppLayout() {
	const { isLoaded, isSignedIn } = useAuth();

	if (!isLoaded) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
			</div>
		);
	}

	if (!isSignedIn) {
		// Redirect via router would be cleaner but this works for the guard
		window.location.href = '/login';
		return null;
	}

	return <Outlet />;
}
