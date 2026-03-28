import { ProjectShell } from '@/components/shell';
import {
	buildCanvasProjectResources,
	getActiveProjectResourceName,
} from '@/components/shell/project-resources';
import { useAppStore } from '@/stores/store';
import '@excalidraw/excalidraw/index.css';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ExpandedOverlayLayer } from '../overlays/ExpandedOverlayLayer';
import { AIVectorSelectionOverlay } from './AIVectorSelectionOverlay';
import { CanvasCore } from './CanvasCore';
import { CanvasNotesLayer } from './CanvasNotesLayer';
import { normalizeSceneElements } from './scene-element-normalizer';
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

	const { collaboration, handleSaveNeeded, normalizeSceneChange, canvasQueryData } =
		useCanvasContainerState({
			canvasId,
		});
	const resolvedCanvasQueryData = canvasQueryData as
		| {
				canvas?: { title?: string | null };
				data?: { elements?: unknown[] | null };
		  }
		| undefined;
	const canvasTitle = resolvedCanvasQueryData?.canvas?.title ?? 'Untitled Project';
	const persistedElements = resolvedCanvasQueryData?.data?.elements ?? [];

	const resourceElements = useMemo(
		() => (elements.length > 0 ? elements : normalizeSceneElements(persistedElements as never[])),
		[elements, persistedElements],
	);
	const resources = useMemo(
		() =>
			buildCanvasProjectResources({
				canvasId,
				canvasTitle,
				elements: resourceElements,
			}),
		[canvasId, canvasTitle, resourceElements],
	);
	const currentViewLabel = getActiveProjectResourceName(resources, canvasId, 'Canvas');

	const handleNavigateToResource = (resource: (typeof resources)[number]) => {
		if (resource.type === 'prototype') {
			void navigate({
				to: '/canvas/$id/prototype/$prototypeId',
				params: {
					id: canvasId,
					prototypeId: resource.id,
				},
			});
			return;
		}

		void navigate({
			to: '/canvas/$id',
			params: { id: canvasId },
		});
	};

	const handleNavigateToSettings = () => {
		void navigate({ to: '/dashboard' });
	};

	return (
		<ProjectShell
			projectId="default"
			projectName={canvasTitle}
			canvasId={canvasId}
			currentViewLabel={currentViewLabel}
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
