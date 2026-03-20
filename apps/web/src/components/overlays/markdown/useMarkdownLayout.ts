import { useMountEffect } from '@/hooks/useMountEffect';
import { useMemo, useRef, useState } from 'react';
import {
	MARKDOWN_HEADER_FULL_BREAKPOINT,
	MARKDOWN_HEADER_HIDDEN_BREAKPOINT,
	TITLE_COMPACT_BREAKPOINT,
} from './markdown-note-helpers';
import type { ControlsLayout, UtilityPanel } from './markdown-note-helpers';

interface UseMarkdownLayoutProps {
	isSelected: boolean;
	autoHideToolbar: boolean;
	elementWidth: number;
	isCompactControlsVisible: boolean;
	activeUtilityPanel: UtilityPanel;
	isPreview: boolean;
}

interface UseMarkdownLayoutReturn {
	headerRef: React.RefObject<HTMLDivElement | null>;
	showHeader: boolean;
	headerWidth: number;
	controlsLayout: ControlsLayout;
	compactTitle: boolean;
	showCompactControls: boolean;
	effectiveIsCompactControlsVisible: boolean;
}

export function useMarkdownLayout({
	isSelected,
	autoHideToolbar,
	elementWidth,
	isCompactControlsVisible,
	activeUtilityPanel,
	isPreview,
}: UseMarkdownLayoutProps): UseMarkdownLayoutReturn {
	const headerRef = useRef<HTMLDivElement>(null);
	const [headerWidth, setHeaderWidth] = useState(elementWidth);

	// ResizeObserver for header width
	useMountEffect(() => {
		const node = headerRef.current;
		if (!node) return;

		const updateWidth = () => {
			setHeaderWidth(node.getBoundingClientRect().width);
		};

		updateWidth();

		const resizeObserver = new ResizeObserver(() => updateWidth());
		resizeObserver.observe(node);
		return () => resizeObserver.disconnect();
	});

	const showHeader = isSelected || !autoHideToolbar;
	const effectiveHeaderWidth = showHeader && headerWidth > 0 ? headerWidth : elementWidth;

	const controlsLayout: ControlsLayout = useMemo(() => {
		if (effectiveHeaderWidth < MARKDOWN_HEADER_HIDDEN_BREAKPOINT) {
			return 'hidden';
		}
		if (effectiveHeaderWidth < MARKDOWN_HEADER_FULL_BREAKPOINT) {
			return 'icon';
		}
		return 'full';
	}, [effectiveHeaderWidth]);

	// Derived state: reset compact controls when layout changes from hidden
	const effectiveIsCompactControlsVisible = useMemo(() => {
		if (controlsLayout !== 'hidden') {
			return false;
		}
		return isCompactControlsVisible;
	}, [controlsLayout, isCompactControlsVisible]);

	const compactTitle = effectiveHeaderWidth < TITLE_COMPACT_BREAKPOINT;

	const showCompactControls =
		isSelected &&
		controlsLayout === 'hidden' &&
		(effectiveIsCompactControlsVisible || activeUtilityPanel !== 'none');

	return {
		headerRef,
		showHeader,
		headerWidth,
		controlsLayout,
		compactTitle,
		showCompactControls,
		effectiveIsCompactControlsVisible,
	};
}
