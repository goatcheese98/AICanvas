import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useMemo } from 'react';
import type { ControlsLayout, MarkdownViewMode, UtilityPanel } from './markdown-note-helpers';

interface UseMarkdownDerivedStateProps {
	isSelected: boolean;
	isPreviewState: boolean;
	editorMode: MarkdownEditorMode;
	activeUtilityPanel: UtilityPanel;
	elementBackgroundColor: ExcalidrawElement['backgroundColor'];
	settings: MarkdownNoteSettings;
	elementWidth: number;
	autoHideToolbar: boolean;
	isCompactControlsVisibleState: boolean;
}

interface UseMarkdownDerivedStateReturn {
	/** Whether preview mode is active (forced true when not selected) */
	isPreview: boolean;
	/** Current view mode: 'preview' | editor mode */
	activeMode: MarkdownViewMode;
	/** Background color for the surface */
	surfaceBackground: string;
	/** Whether to show compact title */
	compactTitle: boolean;
	/** Whether to show compact controls */
	showCompactControls: boolean;
	/** Layout type for controls based on available width */
	controlsLayout: ControlsLayout;
	/** Whether header should be shown */
	showHeader: boolean;
	/** Effective compact controls visibility (reset when layout not hidden) */
	effectiveIsCompactControlsVisible: boolean;
}

// Breakpoints for layout calculations
const MARKDOWN_HEADER_HIDDEN_BREAKPOINT = 320;
const MARKDOWN_HEADER_FULL_BREAKPOINT = 570;
const TITLE_COMPACT_BREAKPOINT = 220;

/**
 * Hook for computing derived UI state based on settings and container dimensions.
 * All values are calculated, not stored - pure derivation from props.
 */
export function useMarkdownDerivedState({
	isSelected,
	isPreviewState,
	editorMode,
	activeUtilityPanel,
	elementBackgroundColor,
	settings,
	elementWidth,
	autoHideToolbar,
	isCompactControlsVisibleState,
}: UseMarkdownDerivedStateProps): UseMarkdownDerivedStateReturn {
	// Preview is forced when not selected
	const isPreview = !isSelected ? true : isPreviewState;

	// Active mode is preview when in preview, otherwise use editor mode
	const activeMode: MarkdownViewMode = isPreview ? 'preview' : editorMode;

	// Surface background prioritizes element color, falls back to settings
	const surfaceBackground = elementBackgroundColor ?? settings.background;

	// Header visibility based on selection and auto-hide setting
	const showHeader = isSelected || !autoHideToolbar;

	// Use element width as effective header width when header is hidden
	const effectiveHeaderWidth = showHeader ? elementWidth : elementWidth;

	// Controls layout based on available width
	const controlsLayout: ControlsLayout = useMemo(() => {
		if (effectiveHeaderWidth < MARKDOWN_HEADER_HIDDEN_BREAKPOINT) {
			return 'hidden';
		}
		if (effectiveHeaderWidth < MARKDOWN_HEADER_FULL_BREAKPOINT) {
			return 'icon';
		}
		return 'full';
	}, [effectiveHeaderWidth]);

	// Compact title when width is below threshold
	const compactTitle = effectiveHeaderWidth < TITLE_COMPACT_BREAKPOINT;

	// Reset compact controls visibility when layout is not hidden
	const effectiveIsCompactControlsVisible =
		controlsLayout !== 'hidden' ? false : isCompactControlsVisibleState;

	// Show compact controls only in specific conditions
	const showCompactControls =
		isSelected &&
		controlsLayout === 'hidden' &&
		(effectiveIsCompactControlsVisible || activeUtilityPanel !== 'none');

	return {
		isPreview,
		activeMode,
		surfaceBackground,
		compactTitle,
		showCompactControls,
		controlsLayout,
		showHeader,
		effectiveIsCompactControlsVisible,
	};
}
