/**
 * Canvas Tour Page State Hook - Orchestrator Pattern
 *
 * This is the main orchestrator hook that composes smaller, focused hooks:
 * - useCanvasTourNavigation: Scene/chapter navigation and mode switching
 * - useCanvasTourRegistry: Registry CRUD operations and persistence
 * - useOverlayPlacement: Viewport measurement and overlay positioning
 *
 * Container/Hook/Child Pattern:
 * - This file maintains the same CanvasTourPageState interface for consumers
 * - All logic is delegated to focused child hooks
 * - Only responsible for composing state and wiring dependencies
 */

import { useMemo, useRef } from 'react';
import type { CanvasTourChapter } from './canvas-tour-content';
import { canvasTourChapters } from './canvas-tour-content';
import { TOUR_IMAGE_FILE_ID } from './canvas-tour-scene';
import type { CanvasTourPageState } from './canvas-tour-types';
import { useCanvasTourNavigation } from './useCanvasTourNavigation';
import { useCanvasTourRegistry } from './useCanvasTourRegistry';
import { useOverlayPlacement } from './useOverlayPlacement';

function getChapterById(sceneId: string, fallback: CanvasTourChapter): CanvasTourChapter {
	return canvasTourChapters.find((chapter) => chapter.id === sceneId) ?? fallback;
}

export function useCanvasTourPageState(): CanvasTourPageState {
	const imageId = TOUR_IMAGE_FILE_ID;
	const activeChapter = canvasTourChapters[0];
	const stageViewportRef = useRef<HTMLDivElement | null>(null);
	const overlayShellRef = useRef<HTMLDivElement | null>(null);
	const layoutPanelRef = useRef<HTMLDivElement | null>(null);

	// Navigation hook: mode switching, tool state, surface epoch
	const navigation = useCanvasTourNavigation({
		initialGuideMode: true,
		initialGridVisible: true,
		initialActiveTool: 'selection',
		initialRegistryOpen: false,
	});

	// Registry hook: scene persistence, overlay drafts, dev status
	const registry = useCanvasTourRegistry({
		isGuideMode: navigation.isGuideMode,
		setActiveTool: navigation.setActiveTool,
	});

	// Overlay placement hook: viewport measurement, positioning, safe areas
	const overlayPlacement = useOverlayPlacement({
		isGuideMode: navigation.isGuideMode,
		isRegistryOpen: navigation.isRegistryOpen,
		registrySceneId: registry.registrySceneId,
		activeChapterId: activeChapter.id,
		guideOverlay: registry.guideOverlay,
		overlayDraft: registry.overlayDraft,
		setOverlayDraft: registry.setOverlayDraft,
		stageViewportRef,
		overlayShellRef,
		layoutPanelRef,
	});

	// Computed registry state
	const showRegistryControls = import.meta.env.DEV && !navigation.isGuideMode;
	const selectedRegistryChapter = useMemo(
		() => getChapterById(registry.registrySceneId, activeChapter),
		[registry.registrySceneId, activeChapter],
	);
	const selectedRegisteredScene = useMemo(
		() => registry.getRegisteredSceneForId(registry.registrySceneId),
		[registry.getRegisteredSceneForId, registry.registrySceneId],
	);

	return {
		// Core refs and data
		imageId,
		activeChapter,
		defaultScene: registry.defaultScene,
		stageViewportRef,
		overlayShellRef,
		layoutPanelRef,

		// Navigation state
		isGuideMode: navigation.isGuideMode,
		isGridVisible: navigation.isGridVisible,
		activeTool: navigation.activeTool,
		surfaceEpoch: navigation.surfaceEpoch,
		isRegistryOpen: navigation.isRegistryOpen,

		// Registry state
		registeredSceneLibrary: registry.registeredSceneLibrary,
		registrySceneId: registry.registrySceneId,
		registryCaptureMode: registry.registryCaptureMode,
		guideBaseline: registry.guideBaseline,
		guideOverlay: registry.guideOverlay,
		overlayDraft: registry.overlayDraft,
		devCaptureStatus: registry.devCaptureStatus,

		// Overlay measurement state
		stageViewportSize: overlayPlacement.stageViewportSize,
		overlayShellHeightPx: overlayPlacement.overlayShellHeightPx,
		rootFontSizePx: overlayPlacement.rootFontSizePx,
		guideSafeArea: overlayPlacement.guideSafeArea,
		editorSafeArea: overlayPlacement.editorSafeArea,
		overlayPlacementBounds: overlayPlacement.overlayPlacementBounds,

		// Overlay placement state
		guidePlacement: overlayPlacement.guidePlacement,
		previewPlacement: overlayPlacement.previewPlacement,
		displayedPlacement: overlayPlacement.displayedPlacement,
		visibleOverlay: overlayPlacement.visibleOverlay,
		introOverlayStyle: overlayPlacement.introOverlayStyle,

		// Computed flags
		showRegistryControls,
		selectedRegistryChapter,
		selectedRegisteredScene,

		// Navigation actions
		resetDemo: navigation.resetDemo,
		enterGuideMode: navigation.enterGuideMode,
		enterExploreMode: navigation.enterExploreMode,
		setIsGridVisible: navigation.setIsGridVisible,
		setActiveTool: navigation.setActiveTool,
		setIsRegistryOpen: navigation.setIsRegistryOpen,

		// Registry actions
		registerCurrentLayout: registry.registerCurrentLayout,
		restoreRegisteredLayout: registry.restoreRegisteredLayout,
		clearRegisteredLayout: registry.clearRegisteredLayout,
		saveOverlayDraft: registry.saveOverlayDraft,
		applyOverlayDraft: registry.applyOverlayDraft,
		copyRegisteredLayout: registry.copyRegisteredLayout,
		setRegistrySceneId: registry.setRegistrySceneId,
		setRegistryCaptureMode: registry.setRegistryCaptureMode,

		// Overlay placement actions
		updateOverlayDraft: overlayPlacement.updateOverlayDraft,
		updateOverlayPlacement: overlayPlacement.updateOverlayPlacement,
		nudgeOverlayPlacement: overlayPlacement.nudgeOverlayPlacement,
		applyOverlayPreset: overlayPlacement.applyOverlayPreset,
		setStageViewportSize: overlayPlacement.setStageViewportSize,
	};
}

// Re-export types from the types file for backward compatibility
