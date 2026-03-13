import { Suspense, lazy } from 'react';
import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router';

const CanvasContainer = lazy(() =>
	import('@/components/canvas/CanvasContainer').then((module) => ({
		default: module.CanvasContainer,
	})),
);

export const Route = createFileRoute('/_app/canvas/$id')({
	component: CanvasPage,
});

function CanvasPage() {
	const { id } = Route.useParams();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	if (pathname.includes('/prototype/')) {
		return <Outlet />;
	}

	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center bg-[var(--color-canvas-bg)]">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
				</div>
			}
		>
			<CanvasContainer canvasId={id} />
		</Suspense>
	);
}
