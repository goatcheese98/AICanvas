import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router';
import { CanvasContainer } from '@/components/canvas/CanvasContainer';

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

	return <CanvasContainer canvasId={id} />;
}
