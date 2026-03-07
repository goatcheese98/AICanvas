import { createFileRoute } from '@tanstack/react-router';
import { CanvasContainer } from '@/components/canvas/CanvasContainer';

export const Route = createFileRoute('/_app/canvas/$id')({
	component: CanvasPage,
});

function CanvasPage() {
	const { id } = Route.useParams();
	return <CanvasContainer canvasId={id} />;
}
