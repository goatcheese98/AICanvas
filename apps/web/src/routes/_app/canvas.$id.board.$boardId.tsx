import { createFileRoute } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

const BoardStudioPage = lazy(() =>
	import('@/components/board/BoardStudioPage').then((module) => ({
		default: module.BoardStudioPage,
	})),
);

export const Route = createFileRoute('/_app/canvas/$id/board/$boardId')({
	component: BoardStudioRoute,
});

function BoardStudioRoute() {
	const { id, boardId } = Route.useParams();

	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center bg-stone-50">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" />
				</div>
			}
		>
			<BoardStudioPage canvasId={id} boardId={boardId} />
		</Suspense>
	);
}
