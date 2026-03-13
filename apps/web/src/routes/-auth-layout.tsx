import { Outlet } from '@tanstack/react-router';
import { ClerkRouteProvider } from './-clerk-provider';

export function AuthLayout() {
	return (
		<ClerkRouteProvider>
			<div className="flex min-h-full items-center justify-center bg-[var(--color-surface)]">
				<div className="w-full max-w-md p-8">
					<Outlet />
				</div>
			</div>
		</ClerkRouteProvider>
	);
}
