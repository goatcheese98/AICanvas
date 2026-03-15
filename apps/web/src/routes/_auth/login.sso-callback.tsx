import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/login/sso-callback')({
	component: lazyRouteComponent(
		() => import('./-oauth-callback-view'),
		'AuthRedirectCallbackPage',
	),
});
