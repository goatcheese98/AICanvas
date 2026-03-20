/**
 * Overlay placement hook for canvas tour page.
 *
 * Container/Hook/Child Pattern:
 * - Manages viewport measurement via ResizeObserver
 * - Handles safe area calculations
 * - Manages overlay positioning state
 */

import { useMountEffect } from '@/hooks/useMountEffect';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CanvasTourGuideOverlay } from './canvas-tour-content';
import {
	OVERLAY_DEFAULT_HEIGHT_REM,
	type OverlayPlacementBounds,
	type OverlayPlacementPreset,
	type OverlaySafeArea,
	buildOverlayPlacementBounds,
	buildSafeArea,
	calculateOverlayPreset,
	clamp,
	clampOverlayPlacement,
	getRootFontSizePx,
} from './canvas-tour-page-utils';
import type {
	CanvasTourOverlayMeasurementState,
	CanvasTourOverlayPlacementState,
	CanvasTourOverlayPlacementActions,
} from './canvas-tour-types';

export interface UseOverlayPlacementResult
	extends CanvasTourOverlayMeasurementState,
		CanvasTourOverlayPlacementState,
		CanvasTourOverlayPlacementActions {}

interface UseOverlayPlacementArgs {
	isGuideMode: boolean;
	isRegistryOpen: boolean;
	registrySceneId: string;
	activeChapterId: string;
	guideOverlay: CanvasTourGuideOverlay;
	overlayDraft: CanvasTourGuideOverlay;
	setOverlayDraft: React.Dispatch<React.SetStateAction<CanvasTourGuideOverlay>>;
	stageViewportRef: React.RefObject<HTMLDivElement | null>;
	overlayShellRef: React.RefObject<HTMLDivElement | null>;
	layoutPanelRef: React.RefObject<HTMLDivElement | null>;
}

const IS_DEV = import.meta.env.DEV;

export function useOverlayPlacement({
	isGuideMode,
	isRegistryOpen,
	registrySceneId,
	activeChapterId,
	guideOverlay,
	overlayDraft,
	setOverlayDraft,
	stageViewportRef,
	overlayShellRef,
	layoutPanelRef,
}: UseOverlayPlacementArgs): UseOverlayPlacementResult {
	const [overlayShellHeightPx, setOverlayShellHeightPx] = useState(0);
	const [stageViewportSize, setStageViewportSize] = useState({ widthPx: 0, heightPx: 0 });

	// Use mount effect for viewport measurement with ResizeObserver
	useMountEffect(() => {
		if (typeof window === 'undefined') return;
		const root = document.documentElement;
		const stageNode = stageViewportRef.current;
		if (!stageNode) return;

		const measure = () => {
			const rect = stageNode.getBoundingClientRect();
			setStageViewportSize({
				widthPx: rect.width,
				heightPx: rect.height,
			});
		};

		measure();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', measure);
			return () => window.removeEventListener('resize', measure);
		}
		const observer = new ResizeObserver(() => measure());
		observer.observe(stageNode);
		observer.observe(root);
		return () => observer.disconnect();
	});

	// Use mount effect for overlay shell measurement with ResizeObserver
	// Re-run when dependencies change by using a key ref pattern
	const shellMeasureKey = `${isGuideMode}:${isRegistryOpen}:${registrySceneId}`;
	const prevShellMeasureKeyRef = useRef(shellMeasureKey);
	useMountEffect(() => {
		if (typeof window === 'undefined') return;
		const shellNode = overlayShellRef.current;
		if (!shellNode) {
			setOverlayShellHeightPx(0);
			return;
		}

		const measure = () => setOverlayShellHeightPx(shellNode.getBoundingClientRect().height);
		measure();
		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', measure);
			return () => window.removeEventListener('resize', measure);
		}
		const observer = new ResizeObserver(() => measure());
		observer.observe(shellNode);
		return () => observer.disconnect();
	});

	// Re-measure shell when key changes (derived state pattern)
	if (shellMeasureKey !== prevShellMeasureKeyRef.current) {
		prevShellMeasureKeyRef.current = shellMeasureKey;
		if (typeof window !== 'undefined' && overlayShellRef.current) {
			setOverlayShellHeightPx(overlayShellRef.current.getBoundingClientRect().height);
		}
	}

	// Overlay placement computed values
	const rootFontSizePx = useMemo(() => getRootFontSizePx(), []);
	const overlayHeightPx =
		overlayShellHeightPx > 0 ? overlayShellHeightPx : OVERLAY_DEFAULT_HEIGHT_REM * rootFontSizePx;
	const layoutPanelWidthPx =
		IS_DEV && !isGuideMode && isRegistryOpen && layoutPanelRef.current
			? layoutPanelRef.current.getBoundingClientRect().width
			: 0;

	const guideSafeArea = useMemo(
		() => buildSafeArea(false, stageViewportSize, layoutPanelWidthPx, rootFontSizePx),
		[layoutPanelWidthPx, rootFontSizePx, stageViewportSize],
	);
	const editorSafeArea = useMemo(
		() =>
			buildSafeArea(
				IS_DEV && !isGuideMode && isRegistryOpen,
				stageViewportSize,
				layoutPanelWidthPx,
				rootFontSizePx,
			),
		[isRegistryOpen, isGuideMode, layoutPanelWidthPx, rootFontSizePx, stageViewportSize],
	);

	const overlayPlacementBounds = useMemo(
		() => buildOverlayPlacementBounds(guideSafeArea, rootFontSizePx),
		[guideSafeArea, rootFontSizePx],
	);

	const visibleOverlay = useMemo(() => {
		if (!isGuideMode && isRegistryOpen && registrySceneId === activeChapterId) {
			return overlayDraft;
		}
		return guideOverlay;
	}, [isGuideMode, isRegistryOpen, registrySceneId, activeChapterId, overlayDraft, guideOverlay]);

	const clampPlacement = useCallback(
		(placement: CanvasTourGuideOverlay['placement'], area: OverlaySafeArea) => {
			return clampOverlayPlacement(placement, area, overlayHeightPx, rootFontSizePx);
		},
		[overlayHeightPx, rootFontSizePx],
	);

	const guidePlacement = useMemo(
		() => clampPlacement(visibleOverlay.placement, guideSafeArea),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[visibleOverlay.placement, guideSafeArea, clampPlacement],
	);
	const previewPlacement = useMemo(
		() => clampPlacement(guidePlacement, editorSafeArea),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[guidePlacement, editorSafeArea, clampPlacement],
	);

	const displayedPlacement = useMemo(() => {
		if (!isGuideMode && isRegistryOpen && registrySceneId === activeChapterId) {
			return previewPlacement;
		}
		return guidePlacement;
	}, [
		isGuideMode,
		isRegistryOpen,
		registrySceneId,
		activeChapterId,
		previewPlacement,
		guidePlacement,
	]);

	const introOverlayStyle = useMemo(
		() =>
			({
				'--overlay-accent': visibleOverlay.accentColor,
				'--overlay-surface-opacity': visibleOverlay.surfaceOpacity.toString(),
				left: `${displayedPlacement.leftRem}rem`,
				top: `${displayedPlacement.topRem}rem`,
				width: `${displayedPlacement.widthRem}rem`,
			}) as React.CSSProperties,
		[visibleOverlay.accentColor, visibleOverlay.surfaceOpacity, displayedPlacement],
	);

	// Overlay placement actions
	const updateOverlayDraft = useCallback(
		(
			patch: Partial<Omit<CanvasTourGuideOverlay, 'placement'>> & {
				placement?: Partial<CanvasTourGuideOverlay['placement']>;
			},
		) => {
			setOverlayDraft((current) => ({
				...current,
				...patch,
				placement: patch.placement
					? { ...current.placement, ...patch.placement }
					: current.placement,
			}));
		},
		[setOverlayDraft],
	);

	const updateOverlayPlacement = useCallback(
		(key: keyof CanvasTourGuideOverlay['placement'], value: number) => {
			const normalizedValue =
				key === 'widthRem'
					? clamp(value, overlayPlacementBounds.widthMinRem, overlayPlacementBounds.widthMaxRem)
					: key === 'leftRem'
						? clamp(value, overlayPlacementBounds.leftMinRem, overlayPlacementBounds.leftMaxRem)
						: clamp(value, overlayPlacementBounds.topMinRem, overlayPlacementBounds.topMaxRem);
			updateOverlayDraft({
				placement: {
					[key]: normalizedValue,
				} as Partial<CanvasTourGuideOverlay['placement']>,
			});
		},
		[overlayPlacementBounds, updateOverlayDraft],
	);

	const nudgeOverlayPlacement = useCallback(
		(key: keyof Pick<CanvasTourGuideOverlay['placement'], 'leftRem' | 'topRem'>, delta: number) => {
			updateOverlayPlacement(key, overlayDraft.placement[key] + delta);
		},
		[overlayDraft.placement, updateOverlayPlacement],
	);

	const applyOverlayPreset = useCallback(
		(preset: OverlayPlacementPreset) => {
			const nextPlacement = calculateOverlayPreset(
				preset,
				guideSafeArea,
				overlayHeightPx,
				rootFontSizePx,
				overlayPlacementBounds,
			);
			updateOverlayDraft({ placement: clampPlacement(nextPlacement, guideSafeArea) });
		},
		[
			guideSafeArea,
			overlayHeightPx,
			rootFontSizePx,
			overlayPlacementBounds,
			updateOverlayDraft,
			clampPlacement,
		],
	);

	return {
		// Measurement state
		stageViewportSize,
		overlayShellHeightPx,
		rootFontSizePx,
		guideSafeArea,
		editorSafeArea,
		overlayPlacementBounds,
		// Placement state
		guidePlacement,
		previewPlacement,
		displayedPlacement,
		visibleOverlay,
		introOverlayStyle,
		// Actions
		updateOverlayDraft,
		updateOverlayPlacement,
		nudgeOverlayPlacement,
		applyOverlayPreset,
		setStageViewportSize,
	};
}
