import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
	component: AuthLayout,
});

function AuthLayout() {
	return (
		<div className="flex min-h-full items-center justify-center bg-[var(--color-surface)]">
			<div className="w-full max-w-md p-8">
				<Outlet />
			</div>
		</div>
	);
}
