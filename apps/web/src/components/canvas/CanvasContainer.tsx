import { useAppStore } from '@/stores/store';
import '@excalidraw/excalidraw/index.css';
import { ExpandedOverlayLayer } from '../overlays/ExpandedOverlayLayer';
import { AIVectorSelectionOverlay } from './AIVectorSelectionOverlay';
import { CanvasCore } from './CanvasCore';
import { CanvasNotesLayer } from './CanvasNotesLayer';
import { CanvasUI } from './CanvasUI';
import { useCanvasContainerState } from './useCanvasContainerState';

interface CanvasContainerProps {
	canvasId: string;
}

/**
 * CanvasContainer - Main canvas orchestrator component.
 *
 * Follows the Container/Hook/Child pattern:
 * - State management extracted to useCanvasContainerState hook
 * - Utilities extracted to canvas-container-utils.ts
 * - Child components handle specific UI concerns
 */
export function CanvasContainer({ canvasId }: CanvasContainerProps) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);

	const { collaboration, handleSaveNeeded, normalizeSceneChange } = useCanvasContainerState({
		canvasId,
	});

	return (
		<div className="relative h-full w-full overflow-hidden">
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
			<CanvasUI canvasId={canvasId} collaboration={collaboration} />
		</div>
	);
}
