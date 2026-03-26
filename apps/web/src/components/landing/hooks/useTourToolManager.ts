import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback } from 'react';
import { type TourTool, getTourTool } from '../tour-types';

interface UseTourToolManagerArgs {
	excalidrawApiRef: React.MutableRefObject<ExcalidrawImperativeAPI | null>;
	isGuideMode: boolean;
	setActiveTool: (tool: TourTool) => void;
}

interface UseTourToolManagerReturn {
	getTourTool: (value: unknown) => TourTool | null;
	handleToolSelect: (tool: TourTool) => void;
}

export function useTourToolManager({
	excalidrawApiRef,
	isGuideMode,
	setActiveTool,
}: UseTourToolManagerArgs): UseTourToolManagerReturn {
	const handleToolSelect = useCallback(
		(tool: TourTool) => {
			if (isGuideMode) return;
			const api = excalidrawApiRef.current;
			if (!api) return;
			api.setActiveTool(
				tool === 'image'
					? { type: 'image', insertOnCanvasDirectly: true, locked: false }
					: { type: tool, locked: false },
			);
			setActiveTool(tool);
		},
		[isGuideMode, setActiveTool, excalidrawApiRef],
	);

	return {
		getTourTool,
		handleToolSelect,
	};
}
