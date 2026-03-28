import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

const CanvasContainerV2 = lazy(() =>
	import('@/components/canvas/CanvasContainerV2').then((module) => ({
		default: module.CanvasContainerV2,
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

	if (pathname.includes('/prototype/') || pathname.includes('/board/')) {
		return <Outlet />;
	}

	return (
		<Suspense
			fallback={
				<div className="flex h-screen w-screen items-center justify-center bg-stone-50">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
				</div>
			}
		>
			<CanvasContainerV2 canvasId={id} />
		</Suspense>
	);
}
