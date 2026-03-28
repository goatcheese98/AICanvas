import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useEffect, useMemo, useRef } from 'react';
import { isHeavyOverlayType } from './resource-type-utils';

interface UseDetailsPanelOnSelectionOptions {
	/** Called when a heavy resource is selected */
	onOpenDetails: () => void;
	/** Whether the details panel is already open */
	isDetailsPanelOpen: boolean;
}

interface UseDetailsPanelOnSelectionResult {
	/** The currently selected overlay element, if any */
	selectedElement: ExcalidrawElement | null;
	/** Whether the selected element is a heavy resource */
	isHeavyResource: boolean;
}

/**
 * Hook that monitors canvas selection and opens the Details panel
 * when a "heavy" resource (kanban, newlex) is selected.
 *
 * Heavy resources get the Details panel on single-click.
 * Light resources (markdown, web-embed) do not.
 *
 * Note: This hook intentionally skips the shell's first mount so it
 * doesn't resize the layout while Excalidraw is still initializing.
 * After mount, it only reacts to actual selection changes and will not
 * retrigger while the Details panel is already open.
 */
export function useDetailsPanelOnSelection({
	onOpenDetails,
	isDetailsPanelOpen,
}: UseDetailsPanelOnSelectionOptions): UseDetailsPanelOnSelectionResult {
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore((s) => s.appState.selectedElementIds ?? {});
	const hasMountedRef = useRef(false);

	// Track previous selection to avoid re-triggering when clicking same element
	const previousSelectionRef = useRef<string | null>(null);

	// Find the currently selected element
	const selectedElement = useMemo(() => {
		const selectedIds = Object.keys(selectedElementIds);
		if (selectedIds.length !== 1) {
			return null;
		}
		const selectedId = selectedIds[0];
		return elements.find((el) => el.id === selectedId) ?? null;
	}, [elements, selectedElementIds]);

	// Check if selected element is a heavy resource
	const isHeavyResource = useMemo(() => {
		if (!selectedElement) return false;
		const customData = selectedElement.customData as { type?: unknown } | undefined;
		return isHeavyOverlayType(customData?.type);
	}, [selectedElement]);

	const selectedElementId = selectedElement?.id ?? null;

	// Open details only after the shell has mounted. Doing this during the first
	// render cycle can create a layout/update loop while Excalidraw is still
	// initializing.
	useEffect(() => {
		if (!hasMountedRef.current) {
			hasMountedRef.current = true;
			previousSelectionRef.current = selectedElementId;
			return;
		}

		const previousId = previousSelectionRef.current;
		previousSelectionRef.current = selectedElementId;

		if (
			selectedElementId &&
			isHeavyResource &&
			selectedElementId !== previousId &&
			!isDetailsPanelOpen
		) {
			onOpenDetails();
		}
	}, [selectedElementId, isHeavyResource, onOpenDetails, isDetailsPanelOpen]);

	return {
		selectedElement,
		isHeavyResource,
	};
}
