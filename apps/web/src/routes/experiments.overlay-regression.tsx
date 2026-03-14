import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/experiments/overlay-regression')({
	component: lazyRouteComponent(
		() => import('../components/experiments/OverlayRegressionPage'),
		'OverlayRegressionPage',
	),
});
