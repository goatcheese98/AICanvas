import { ProjectShell } from '@/components/shell';
import { useAppStore } from '@/stores/store';
import '@excalidraw/excalidraw/index.css';
import { useNavigate } from '@tanstack/react-router';
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

	const { collaboration, handleSaveNeeded, normalizeSceneChange } = useCanvasContainerState({
		canvasId,
	});

	const handleNavigateToResource = () => {
		// For now, resources just navigate to themselves
		// In v2 with multiple resources, this would navigate to board/prototype views
		console.log('Navigate to resource');
	};

	return (
		<ProjectShell
			projectId="default"
			projectName="Untitled Project"
			canvasId={canvasId}
			collaboration={collaboration}
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
