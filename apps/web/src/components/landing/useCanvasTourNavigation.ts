/**
 * Navigation hook for canvas tour page.
 *
 * Container/Hook/Child Pattern:
 * - Manages scene/chapter navigation state
 * - Handles mode switching between guide and explore
 * - Returns state and actions for navigation
 */

import { useCallback, useState } from 'react';
import type { CanvasTourNavigationActions, CanvasTourNavigationState } from './canvas-tour-types';
import type { CanvasSceneSnapshot, TourTool } from './useCanvasTourSceneController';

export interface UseCanvasTourNavigationResult
	extends CanvasTourNavigationState,
		CanvasTourNavigationActions {
	setActiveTool: React.Dispatch<React.SetStateAction<TourTool>>;
}

interface UseCanvasTourNavigationArgs {
	initialGuideMode?: boolean;
	initialGridVisible?: boolean;
	initialActiveTool?: TourTool;
	initialRegistryOpen?: boolean;
}

export interface UseCanvasTourNavigationReturn {
	isGuideMode: boolean;
	isGridVisible: boolean;
	activeTool: TourTool;
	surfaceEpoch: number;
	isRegistryOpen: boolean;
	resetDemo: () => void;
	enterGuideMode: (getCurrentSceneSnapshot: () => CanvasSceneSnapshot) => void;
	enterExploreMode: (
		getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
		getExploreSessionSnapshot: () => CanvasSceneSnapshot | null,
	) => void;
	setIsGridVisible: React.Dispatch<React.SetStateAction<boolean>>;
	setActiveTool: React.Dispatch<React.SetStateAction<TourTool>>;
	setIsRegistryOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCanvasTourNavigation({
	initialGuideMode = true,
	initialGridVisible = true,
	initialActiveTool = 'selection',
	initialRegistryOpen = false,
}: UseCanvasTourNavigationArgs = {}): UseCanvasTourNavigationResult {
	const [isGuideMode, setIsGuideMode] = useState(initialGuideMode);
	const [isGridVisible, setIsGridVisible] = useState(initialGridVisible);
	const [activeTool, setActiveTool] = useState<TourTool>(initialActiveTool);
	const [isRegistryOpen, setIsRegistryOpen] = useState(initialRegistryOpen);
	const [surfaceEpoch, setSurfaceEpoch] = useState(0);

	const resetDemo = useCallback(() => {
		setIsRegistryOpen(false);
		setIsGuideMode(true);
		setSurfaceEpoch((current) => current + 1);
		setActiveTool('selection');
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}, []);

	const enterGuideMode = useCallback(
		(getCurrentSceneSnapshot: () => CanvasSceneSnapshot) => {
			if (isGuideMode) return;
			// Explore session snapshot is handled by the caller
			void getCurrentSceneSnapshot;
			setIsGuideMode(true);
			setIsRegistryOpen(false);
			setSurfaceEpoch((current) => current + 1);
			setActiveTool('selection');
		},
		[isGuideMode],
	);

	const enterExploreMode = useCallback(
		(
			getCurrentSceneSnapshot: () => CanvasSceneSnapshot,
			getExploreSessionSnapshot: () => CanvasSceneSnapshot | null,
		) => {
			if (!isGuideMode) return;
			setIsGuideMode(false);
			setSurfaceEpoch((current) => current + 1);
			const exploreSession = getExploreSessionSnapshot();
			if (exploreSession) {
				const nextTool = exploreSession.appState.activeTool?.type;
				if (
					nextTool === 'hand' ||
					nextTool === 'selection' ||
					nextTool === 'rectangle' ||
					nextTool === 'diamond' ||
					nextTool === 'ellipse' ||
					nextTool === 'arrow' ||
					nextTool === 'line' ||
					nextTool === 'freedraw' ||
					nextTool === 'text' ||
					nextTool === 'image' ||
					nextTool === 'eraser'
				) {
					setActiveTool(nextTool);
					return;
				}
			}
			void getCurrentSceneSnapshot;
			setActiveTool('selection');
		},
		[isGuideMode],
	);

	return {
		// State
		isGuideMode,
		isGridVisible,
		activeTool,
		surfaceEpoch,
		isRegistryOpen,
		// Actions
		resetDemo,
		enterGuideMode,
		enterExploreMode,
		setIsGridVisible,
		setActiveTool,
		setIsRegistryOpen,
	};
}
