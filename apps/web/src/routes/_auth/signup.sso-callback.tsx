import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/signup/sso-callback')({
	component: lazyRouteComponent(() => import('./-oauth-callback-view'), 'AuthRedirectCallbackPage'),
});
