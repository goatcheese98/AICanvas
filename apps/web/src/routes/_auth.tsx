import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
	component: lazyRouteComponent(() => import('./-auth-layout'), 'AuthLayout'),
});
