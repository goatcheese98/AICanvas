import { ProjectShell } from '@/components/shell';
import type { ProjectResource } from '@/components/shell/types';
import { useAppStore } from '@/stores/store';
import '@excalidraw/excalidraw/index.css';
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
	const elements = useAppStore((s) => s.elements);
	const navigate = useNavigate();

	const { collaboration, handleSaveNeeded, normalizeSceneChange } = useCanvasContainerState({
		canvasId,
	});

	// Extract board and prototype resources from canvas elements
	const resources: ProjectResource[] = useMemo(() => {
		const canvasResource: ProjectResource = {
			id: canvasId,
			type: 'canvas',
			name: 'Overview',
			isActive: true,
		};

		const overlayResources: ProjectResource[] = [];

		for (const el of elements) {
			if (el.isDeleted) continue;
			const customData = el.customData as { type?: string; title?: string } | undefined;
			if (customData?.type === 'kanban') {
				overlayResources.push({
					id: el.id,
					type: 'board',
					name: customData?.title || 'Untitled Board',
					isActive: false,
				});
			} else if (customData?.type === 'prototype') {
				overlayResources.push({
					id: el.id,
					type: 'prototype',
					name: customData?.title || 'Untitled Prototype',
					isActive: false,
				});
			}
		}

		return [canvasResource, ...overlayResources];
	}, [elements, canvasId]);

	const handleNavigateToResource = (resource: ProjectResource) => {
		if (resource.type === 'canvas') {
			// Already on canvas, no navigation needed
			return;
		}
		if (resource.type === 'board') {
			void navigate({
				to: '/canvas/$id/board/$boardId' as never,
				params: { id: canvasId, boardId: resource.id } as never,
			});
			return;
		}
		if (resource.type === 'prototype') {
			void navigate({
				to: '/canvas/$id/prototype/$prototypeId',
				params: { id: canvasId, prototypeId: resource.id },
			});
			return;
		}
	};

	return (
		<ProjectShell
			projectId="default"
			projectName="Untitled Project"
			canvasId={canvasId}
			collaboration={collaboration}
			resources={resources}
			onNavigateToResource={handleNavigateToResource}
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
