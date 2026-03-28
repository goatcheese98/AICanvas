import { ProjectShell } from '@/components/shell';
import { buildProjectResources } from '@/components/shell/project-resource-utils';
import { useAppStore } from '@/stores/store';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ExpandedOverlayLayer } from '../overlays/ExpandedOverlayLayer';
import { AIVectorSelectionOverlay } from './AIVectorSelectionOverlay';
import { CanvasCore } from './CanvasCore';
import { CanvasNotesLayer } from './CanvasNotesLayer';
import { useCanvasContainerState } from './useCanvasContainerState';

interface CanvasContainerV2Props {
	canvasId: string;
}

/**
 * CanvasContainerV2 - Canvas with the new V2 shell layout.
 *
 * Features:
 * - Left sidebar with project navigation
 * - Main content area for canvas
 * - Right panel for AI and details
 * - No floating toolbars or panels
 */
export function CanvasContainerV2({ canvasId }: CanvasContainerV2Props) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const navigate = useNavigate();

	const { collaboration, handleSaveNeeded, normalizeSceneChange, canvasQueryData } =
		useCanvasContainerState({
			canvasId,
		});

	const canvasData = useMemo(() => {
		const data = canvasQueryData as
			| {
					canvas?: { title?: unknown };
					data?: { elements?: readonly ExcalidrawElement[] };
			  }
			| undefined;

		return {
			title: typeof data?.canvas?.title === 'string' ? data.canvas.title : 'Untitled Project',
			elements: data?.data?.elements ?? [],
		};
	}, [canvasQueryData]);

	const resources = useMemo(
		() =>
			buildProjectResources({
				canvasId,
				canvasName: canvasData.title,
				elements: canvasData.elements,
			}),
		[canvasData.elements, canvasData.title, canvasId],
	);

	const handleNavigateToResource = (resource: (typeof resources)[number]) => {
		if (resource.type === 'canvas') {
			void navigate({ to: '/canvas/$id', params: { id: canvasId } });
			return;
		}

		if (resource.type === 'board') {
			void navigate({
				to: '/canvas/$id/board/$boardId',
				params: { id: canvasId, boardId: resource.id },
			});
		}
	};

	const handleNavigateToSettings = () => {
		void navigate({ to: '/dashboard' });
	};

	return (
		<ProjectShell
			projectId="default"
			projectName={canvasData.title}
			canvasId={canvasId}
			resources={resources}
			activeResourceId={canvasId}
			collaboration={collaboration}
			onNavigateToResource={handleNavigateToResource}
			onNavigateToSettings={handleNavigateToSettings}
		>
			<div className="relative h-full w-full overflow-hidden bg-[var(--color-canvas-bg)]">
				<CanvasCore
					canvasId={canvasId}
					onSaveNeeded={handleSaveNeeded}
					onSceneChange={collaboration.handleSceneChange}
					normalizeSceneChange={normalizeSceneChange}
					onPointerUpdate={collaboration.handlePointerUpdate}
				/>
				{excalidrawApi && <CanvasNotesLayer />}
				{excalidrawApi && <AIVectorSelectionOverlay />}
				{excalidrawApi && <ExpandedOverlayLayer />}
			</div>
		</ProjectShell>
	);
}
