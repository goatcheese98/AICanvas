import { useMountEffect } from '@/hooks/useMountEffect';
import { useSyncExternalStore } from '@/hooks/useSyncExternalStore';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface OverlayShellRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface ViewportSize {
	width: number;
	height: number;
}

interface UseExpandedOverlayStateArgs {
	onClose: () => void;
}

interface UseExpandedOverlayStateResult {
	rect: OverlayShellRect;
	startResize: (handle: ResizeHandle, event: ReactMouseEvent<HTMLDivElement>) => void;
}

const PREFERRED_MIN_SHELL_WIDTH = 560;
const PREFERRED_MIN_SHELL_HEIGHT = 360;
const ABSOLUTE_MIN_SHELL_WIDTH = 320;
const ABSOLUTE_MIN_SHELL_HEIGHT = 240;
const SHELL_MARGIN = 24;

function getMinShellWidth(viewport: ViewportSize) {
	return Math.max(
		ABSOLUTE_MIN_SHELL_WIDTH,
		Math.min(PREFERRED_MIN_SHELL_WIDTH, viewport.width - SHELL_MARGIN * 2),
	);
}

function getMinShellHeight(viewport: ViewportSize) {
	return Math.max(
		ABSOLUTE_MIN_SHELL_HEIGHT,
		Math.min(PREFERRED_MIN_SHELL_HEIGHT, viewport.height - SHELL_MARGIN * 2),
	);
}

function subscribeToViewport(callback: () => void) {
	window.addEventListener('resize', callback);
	return () => window.removeEventListener('resize', callback);
}

function getViewportSnapshot(): ViewportSize {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
	};
}

function getServerViewportSnapshot(): ViewportSize {
	return {
		width: 1440,
		height: 900,
	};
}

function clampRect(rect: OverlayShellRect, viewport: ViewportSize): OverlayShellRect {
	const minWidth = getMinShellWidth(viewport);
	const minHeight = getMinShellHeight(viewport);
	const maxWidth = Math.max(minWidth, viewport.width - SHELL_MARGIN * 2);
	const maxHeight = Math.max(minHeight, viewport.height - SHELL_MARGIN * 2);
	const width = Math.max(minWidth, Math.min(rect.width, maxWidth));
	const height = Math.max(minHeight, Math.min(rect.height, maxHeight));
	const maxX = Math.max(SHELL_MARGIN, viewport.width - width - SHELL_MARGIN);
	const maxY = Math.max(SHELL_MARGIN, viewport.height - height - SHELL_MARGIN);

	return {
		x: Math.min(Math.max(rect.x, SHELL_MARGIN), maxX),
		y: Math.min(Math.max(rect.y, SHELL_MARGIN), maxY),
		width,
		height,
	};
}

function getDefaultRect(viewport: ViewportSize): OverlayShellRect {
	const minWidth = getMinShellWidth(viewport);
	const minHeight = getMinShellHeight(viewport);
	const width = Math.max(minWidth, Math.min(viewport.width * 0.9, viewport.width - 64));
	const height = Math.max(minHeight, Math.min(viewport.height * 0.88, viewport.height - 64));

	return clampRect(
		{
			x: Math.round((viewport.width - width) / 2),
			y: Math.round((viewport.height - height) / 2),
			width: Math.round(width),
			height: Math.round(height),
		},
		viewport,
	);
}

function resizeRect(
	rect: OverlayShellRect,
	handle: ResizeHandle,
	deltaX: number,
	deltaY: number,
): OverlayShellRect {
	const next = { ...rect };

	if (handle.includes('e')) {
		next.width = rect.width + deltaX;
	}
	if (handle.includes('s')) {
		next.height = rect.height + deltaY;
	}
	if (handle.includes('w')) {
		next.x = rect.x + deltaX;
		next.width = rect.width - deltaX;
	}
	if (handle.includes('n')) {
		next.y = rect.y + deltaY;
		next.height = rect.height - deltaY;
	}

	return next;
}

function rectsEqual(a: OverlayShellRect, b: OverlayShellRect): boolean {
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// Create a stable viewport object to avoid infinite re-renders
// useSyncExternalStore with objects can cause issues if getSnapshot returns new objects
function useStableViewport(): ViewportSize {
	const viewportStr = useSyncExternalStore(
		subscribeToViewport,
		() => {
			const vp = getViewportSnapshot();
			return `${vp.width},${vp.height}`;
		},
		() => {
			const vp = getServerViewportSnapshot();
			return `${vp.width},${vp.height}`;
		},
	);

	// Parse the string once per change
	return useMemo(() => {
		const [width, height] = viewportStr.split(',').map(Number);
		return { width, height };
	}, [viewportStr]);
}

export function useExpandedOverlayState({
	onClose,
}: UseExpandedOverlayStateArgs): UseExpandedOverlayStateResult {
	const viewport = useStableViewport();
	const [rect, setRect] = useState<OverlayShellRect>(() => getDefaultRect(viewport));
	const rectRef = useRef(rect);
	const resizeCleanupRef = useRef<(() => void) | null>(null);
	const prevViewportRef = useRef(viewport);
	rectRef.current = rect;

	// Clamp rect when viewport changes, but only if values actually change
	useEffect(() => {
		// Only update if viewport actually changed
		if (
			prevViewportRef.current.width === viewport.width &&
			prevViewportRef.current.height === viewport.height
		) {
			return;
		}
		prevViewportRef.current = viewport;

		setRect((prev) => {
			const clamped = clampRect(prev, viewport);
			return rectsEqual(prev, clamped) ? prev : clamped;
		});
	}, [viewport]);

	const clearResizeListeners = useCallback(() => {
		resizeCleanupRef.current?.();
		resizeCleanupRef.current = null;
	}, []);

	const startResize = useCallback(
		(handle: ResizeHandle, event: ReactMouseEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();

			const origin = {
				x: event.clientX,
				y: event.clientY,
			};
			const initialRect = rectRef.current;

			clearResizeListeners();

			const handleMove = (moveEvent: MouseEvent) => {
				const nextRect = clampRect(
					resizeRect(
						initialRect,
						handle,
						moveEvent.clientX - origin.x,
						moveEvent.clientY - origin.y,
					),
					getViewportSnapshot(),
				);
				rectRef.current = nextRect;
				setRect(nextRect);
			};

			const handleUp = () => {
				clearResizeListeners();
			};

			resizeCleanupRef.current = () => {
				window.removeEventListener('mousemove', handleMove);
				window.removeEventListener('mouseup', handleUp);
			};

			window.addEventListener('mousemove', handleMove);
			window.addEventListener('mouseup', handleUp);
		},
		[clearResizeListeners],
	);

	useMountEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			clearResizeListeners();
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	return {
		rect,
		startResize,
	};
}
