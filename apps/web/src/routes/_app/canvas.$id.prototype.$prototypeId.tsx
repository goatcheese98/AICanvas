import { Suspense, lazy } from 'react';
import { createFileRoute } from '@tanstack/react-router';

const PrototypeStudioPage = lazy(() =>
	import('@/components/prototype/PrototypeStudioPage').then((module) => ({
		default: module.PrototypeStudioPage,
	})),
);

export const Route = createFileRoute('/_app/canvas/$id/prototype/$prototypeId')({
	component: PrototypeStudioRoute,
});

function PrototypeStudioRoute() {
	const { id, prototypeId } = Route.useParams();

	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center bg-stone-50">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
				</div>
			}
		>
			<PrototypeStudioPage canvasId={id} prototypeId={prototypeId} />
		</Suspense>
	);
}
