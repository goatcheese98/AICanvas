import { useEffect, useRef, useSyncExternalStore } from 'react';

// External resize store for useSyncExternalStore
function createResizeStore() {
	let isResizing = false;
	let timeoutId: number | null = null;
	const listeners = new Set<() => void>();

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	function subscribe(listener: () => void) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	function getSnapshot() {
		return isResizing;
	}

	function startResizing() {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
		if (!isResizing) {
			isResizing = true;
			notify();
		}
		timeoutId = window.setTimeout(() => {
			isResizing = false;
			timeoutId = null;
			notify();
		}, 140);
	}

	return { subscribe, getSnapshot, startResizing };
}

interface UseKanbanResizeOptions {
	elementWidth: number;
	elementHeight: number;
	isSelected: boolean;
	mode: 'preview' | 'shell' | 'live';
}

interface UseKanbanResizeResult {
	isLiveResizing: boolean;
}

export function useKanbanResize({
	elementWidth,
	elementHeight,
	isSelected,
	mode,
}: UseKanbanResizeOptions): UseKanbanResizeResult {
	const previousSizeRef = useRef({ width: elementWidth, height: elementHeight });
	const resizeStoreRef = useRef(createResizeStore());

	// Resize handling with useSyncExternalStore
	const resizeStore = resizeStoreRef.current;
	const isLiveResizing = useSyncExternalStore(
		resizeStore.subscribe,
		resizeStore.getSnapshot,
		() => false,
	);

	// Size change detection
	useEffect(() => {
		const currentSize = { width: elementWidth, height: elementHeight };
		if (
			previousSizeRef.current.width === currentSize.width &&
			previousSizeRef.current.height === currentSize.height
		) {
			return;
		}

		previousSizeRef.current = currentSize;
		if (isSelected && mode !== 'shell') {
			resizeStore.startResizing();
		}
	}, [elementHeight, elementWidth, isSelected, mode, resizeStore]);

	return { isLiveResizing };
}
