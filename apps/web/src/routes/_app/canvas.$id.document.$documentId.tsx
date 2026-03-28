import { createFileRoute } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

const DocumentStudioPage = lazy(() =>
	import('@/components/document/DocumentStudioPage').then((module) => ({
		default: module.DocumentStudioPage,
	})),
);

export const Route = createFileRoute('/_app/canvas/$id/document/$documentId')({
	component: DocumentStudioRoute,
});

function DocumentStudioRoute() {
	const { id, documentId } = Route.useParams();

	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center bg-stone-50">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
				</div>
			}
		>
			<DocumentStudioPage canvasId={id} documentId={documentId} />
		</Suspense>
	);
}
