import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_app')({
	component: lazyRouteComponent(() => import('./-app-layout'), 'AppLayout'),
});
