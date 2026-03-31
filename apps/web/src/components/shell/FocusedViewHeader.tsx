import { Link } from '@tanstack/react-router';

interface FocusedViewHeaderProps {
	projectName: string;
	resourceName: string;
	canvasId: string;
}

/**
 * FocusedViewHeader - Consistent header for focused resource views.
 *
 * Features:
 * - Breadcrumb showing "Project Name / Resource Name"
 * - Back to Canvas button that returns to the overview canvas
 *
 * Used in: BoardStudioPage, DocumentStudioPage, PrototypeStudioPage
 */
export function FocusedViewHeader({ projectName, resourceName, canvasId }: FocusedViewHeaderProps) {
	return (
		<header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-sm">
				<span className="font-medium text-stone-600">{projectName}</span>
				<span className="text-stone-400">/</span>
				<span className="font-semibold text-stone-900">{resourceName}</span>
			</div>

			{/* Back to Canvas */}
			<Link
				to="/canvas/$id"
				params={{ id: canvasId }}
				className="rounded-full border border-stone-300 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700 transition-colors hover:bg-stone-50"
			>
				Back to Canvas
			</Link>
		</header>
	);
}
