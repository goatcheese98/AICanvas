import { useSyncExternalStore } from '@/hooks/useSyncExternalStore';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
	type WebEmbedViewMode,
	clampPipPosition,
	getDefaultPipPosition,
	getPipDimensions,
} from './web-embed-view';

// ===== Viewport dimensions with useSyncExternalStore =====
// Using primitive values to avoid reference equality issues
function subscribeToWindowResize(callback: () => void): () => void {
	window.addEventListener('resize', callback);
	return () => window.removeEventListener('resize', callback);
}

function getWindowWidth(): number {
	return window.innerWidth;
}

function getWindowHeight(): number {
	return window.innerHeight;
}

function getServerWindowWidth(): number {
	return 1440;
}

function getServerWindowHeight(): number {
	return 900;
}

interface WebEmbedElement {
	id: string;
	customData: {
		url: string;
	};
}

interface UseWebEmbedStateArgs {
	element: WebEmbedElement;
	onChange: (elementId: string, url: string) => void;
	onActivityChange?: (isActive: boolean) => void;
}

interface UseWebEmbedStateResult {
	// State
	urlInput: string;
	isEditing: boolean;
	viewMode: WebEmbedViewMode;
	isLoading: boolean;
	viewport: { width: number; height: number };
	pipPosition: { x: number; y: number };

	// Derived state
	isActivelyActive: boolean;
	pipDimensions: { width: number; height: number };

	// Refs for drag cleanup
	pipDragCleanupRef: React.MutableRefObject<(() => void) | null>;

	// Actions
	setUrlInput: (url: string) => void;
	setIsLoading: (loading: boolean) => void;
	setViewMode: (mode: WebEmbedViewMode | ((prev: WebEmbedViewMode) => WebEmbedViewMode)) => void;
	setPipPosition: (
		position:
			| { x: number; y: number }
			| ((prev: { x: number; y: number }) => { x: number; y: number }),
	) => void;
	handleStartEditing: () => void;
	handleStopEditing: () => void;
	handleToggleEdit: () => void;
	handleSubmitUrl: () => void;
	handleTogglePip: () => void;
	handleToggleExpand: () => void;
	clearPipDragListeners: () => void;

	// Callback refs (for parent communication)
	onActivityChangeRef: React.MutableRefObject<((isActive: boolean) => void) | undefined>;
	lastReportedEditingRef: React.MutableRefObject<boolean | null>;
}

export function useWebEmbedState({
	element,
	onChange,
	onActivityChange,
}: UseWebEmbedStateArgs): UseWebEmbedStateResult {
	// Sync external viewport dimensions using primitives to avoid reference equality issues
	const viewportWidth = useSyncExternalStore(
		subscribeToWindowResize,
		getWindowWidth,
		getServerWindowWidth,
	);
	const viewportHeight = useSyncExternalStore(
		subscribeToWindowResize,
		getWindowHeight,
		getServerWindowHeight,
	);

	// Memoize viewport object to prevent unnecessary re-renders
	const viewport = useMemo(
		() => ({ width: viewportWidth, height: viewportHeight }),
		[viewportWidth, viewportHeight],
	);

	// State
	const [urlInput, setUrlInput] = useState(element.customData.url);
	const [isEditing, setIsEditing] = useState(!element.customData.url);
	const [viewMode, setViewMode] = useState<WebEmbedViewMode>('inline');
	const [isLoading, setIsLoading] = useState(false);
	const [pipPosition, setPipPosition] = useState(() => getDefaultPipPosition(viewport));
	const lastSyncedElementUrlRef = useRef(element.customData.url);

	// Refs for parent callbacks and tracking
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const pipDragCleanupRef = useRef<(() => void) | null>(null);

	// Keep callback ref in sync
	// This runs during render - pattern used across codebase for callback refs
	onActivityChangeRef.current = onActivityChange;

	if (lastSyncedElementUrlRef.current !== element.customData.url) {
		lastSyncedElementUrlRef.current = element.customData.url;
		if (urlInput !== element.customData.url) {
			setUrlInput(element.customData.url);
		}
		setIsEditing(!element.customData.url);
		setIsLoading(false);
	}

	// Derived state
	const isActivelyActive = isEditing || viewMode !== 'inline';
	const pipDimensions = useMemo(() => getPipDimensions(viewport.width), [viewport.width]);

	// Clamp PiP position when viewport changes
	const setPipPositionClamped = useCallback(
		(
			position:
				| { x: number; y: number }
				| ((prev: { x: number; y: number }) => { x: number; y: number }),
		) => {
			setPipPosition((current) => {
				const next = typeof position === 'function' ? position(current) : position;
				return clampPipPosition(next, viewport);
			});
		},
		[viewport],
	);

	// Clear PiP drag listeners
	const clearPipDragListeners = useCallback(() => {
		pipDragCleanupRef.current?.();
		pipDragCleanupRef.current = null;
	}, []);

	// Clean up drag listeners when exiting PiP mode
	if (viewMode !== 'pip') {
		clearPipDragListeners();
	}

	// Report activity changes to parent
	// Using conditional during render to report synchronously
	if (lastReportedEditingRef.current !== isActivelyActive) {
		lastReportedEditingRef.current = isActivelyActive;
		onActivityChangeRef.current?.(isActivelyActive);
	}

	// Event handlers
	const handleStartEditing = useCallback(() => {
		setIsEditing(true);
	}, []);

	const handleStopEditing = useCallback(() => {
		setIsEditing(false);
	}, []);

	const handleToggleEdit = useCallback(() => {
		setIsEditing((current) => !current);
	}, []);

	const handleSubmitUrl = useCallback(() => {
		onChange(element.id, urlInput.trim());
		setIsEditing(false);
		setIsLoading(true);
	}, [element.id, onChange, urlInput]);

	const handleTogglePip = useCallback(() => {
		setViewMode((current) => {
			const nextMode = current === 'pip' ? 'inline' : 'pip';
			// Reset PiP position when entering PiP mode
			if (nextMode === 'pip') {
				setPipPosition(getDefaultPipPosition({ width: viewportWidth, height: viewportHeight }));
			}
			return nextMode;
		});
	}, [viewportWidth, viewportHeight]);

	const handleToggleExpand = useCallback(() => {
		setViewMode((current) => (current === 'expanded' ? 'inline' : 'expanded'));
	}, []);

	return {
		// State
		urlInput,
		isEditing,
		viewMode,
		isLoading,
		viewport,
		pipPosition,

		// Derived state
		isActivelyActive,
		pipDimensions,

		// Refs
		pipDragCleanupRef,
		onActivityChangeRef,
		lastReportedEditingRef,

		// Actions
		setUrlInput,
		setIsLoading,
		setViewMode,
		setPipPosition: setPipPositionClamped,
		handleStartEditing,
		handleStopEditing,
		handleToggleEdit,
		handleSubmitUrl,
		handleTogglePip,
		handleToggleExpand,
		clearPipDragListeners,
	};
}
