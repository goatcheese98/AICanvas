import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/experiments/canvas-tour')({
	component: lazyRouteComponent(
		() => import('../components/landing/CanvasTourPage'),
		'CanvasTourPage',
	),
});
