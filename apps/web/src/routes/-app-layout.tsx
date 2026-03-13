import { Outlet } from '@tanstack/react-router';
import { useAuth } from '@clerk/clerk-react';
import { ClerkRouteProvider } from './-clerk-provider';

function AuthenticatedOutlet() {
	const { isLoaded, isSignedIn } = useAuth();

	if (!isLoaded) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
			</div>
		);
	}

	if (!isSignedIn) {
		window.location.href = '/login';
		return null;
	}

	return <Outlet />;
}

export function AppLayout() {
	return (
		<ClerkRouteProvider>
			<AuthenticatedOutlet />
		</ClerkRouteProvider>
	);
}
